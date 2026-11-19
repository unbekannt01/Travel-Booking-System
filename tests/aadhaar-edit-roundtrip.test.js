import test from "node:test"
import assert from "node:assert/strict"
import { isMaskedAadhaar, isValidAadhaar } from "../src/utils/validators.js"
import { validateBookingStep } from "../src/utils/bookingFormHelpers.js"
import {
  isMaskedOrUnchangedAadhaar,
  encryptAadhaar,
  decryptAadhaar,
  validateVerhoeff,
} from "../backend/utils/aadhaar.js"

test("Masked Aadhaar Edit Round-Trip (SEC-012 & Task 0)", async (t) => {
  await t.test("frontend validators identify masked aadhaar and sentinel token", () => {
    assert.equal(isMaskedAadhaar("XXXX XXXX 1234"), true)
    assert.equal(isMaskedAadhaar("XXXX-XXXX-1234"), true)
    assert.equal(isMaskedAadhaar("XXXXXXXX1234"), true)
    assert.equal(isMaskedAadhaar("[UNCHANGED]"), true)
    assert.equal(isMaskedAadhaar("[unchanged]"), true)

    assert.equal(isMaskedAadhaar("123456789012"), false)
    assert.equal(isMaskedAadhaar(""), false)
    assert.equal(isMaskedAadhaar(null), false)
    assert.equal(isMaskedAadhaar(undefined), false)

    // isValidAadhaar with allowMasked
    assert.equal(isValidAadhaar("XXXX XXXX 1234", { allowMasked: true }), true)
    assert.equal(isValidAadhaar("[UNCHANGED]", { allowMasked: true }), true)
    assert.equal(isValidAadhaar("XXXX XXXX 1234", { allowMasked: false }), false)
    assert.equal(isValidAadhaar("123456789012", { allowMasked: true }), true)
  })

  await t.test("backend aadhaar utility identifies masked and unchanged values", () => {
    assert.equal(isMaskedOrUnchangedAadhaar("XXXX XXXX 9999"), true)
    assert.equal(isMaskedOrUnchangedAadhaar("XXXX-XXXX-9999"), true)
    assert.equal(isMaskedOrUnchangedAadhaar("[UNCHANGED]"), true)
    assert.equal(isMaskedOrUnchangedAadhaar("[unchanged]"), true)

    assert.equal(isMaskedOrUnchangedAadhaar("999988887777"), false)
    assert.equal(isMaskedOrUnchangedAadhaar(""), false)
    assert.equal(isMaskedOrUnchangedAadhaar(null), false)
  })

  await t.test("BookingForm Step 1 validator accepts masked aadhaar during edit", () => {
    const formData = {
      passengers: [
        {
          name: "Ramesh Patel",
          age: "42",
          gender: "Male",
          city: "Ahmedabad",
          seatId: "lower-L1-1",
          aadhar: "XXXX XXXX 5678",
        },
      ],
    }

    const result = validateBookingStep(1, formData, { bookedSeats: [] })
    assert.equal(result.valid, true, "Validation should pass with masked aadhaar")
    assert.equal(Object.keys(result.errors).length, 0)
  })

  await t.test("Backend passenger reconciliation preserves existing encrypted Aadhaar on edit", () => {
    // Original Aadhaar
    const rawAadhaar = "999999990019" // Verhoeff valid
    assert.equal(validateVerhoeff(rawAadhaar), true)
    const existingCiphertext = encryptAadhaar(rawAadhaar)
    assert.notEqual(existingCiphertext, rawAadhaar)
    assert.equal(existingCiphertext.split(":").length, 3)

    const existingPax = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        age: 42,
        gender: "Male",
        city: "Ahmedabad",
        seatId: "lower-L1-1",
        aadhar: existingCiphertext,
        aadharEncrypted: true,
      },
    ]

    // Simulate incoming PUT request with [UNCHANGED] sentinel
    const incomingPassengers = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        age: 43, // updated age
        gender: "Male",
        city: "Gandhinagar", // updated city
        seatId: "lower-L1-1",
        aadhar: "[UNCHANGED]",
      },
    ]

    const existingPaxById = new Map()
    const existingPaxBySeat = new Map()
    for (const ep of existingPax) {
      if (ep._id) existingPaxById.set(String(ep._id), ep)
      if (ep.seatId) existingPaxBySeat.set(ep.seatId, ep)
    }

    const updatedPax = incomingPassengers.map((p) => {
      const paxObj = { ...p }
      const matched =
        (p._id && existingPaxById.get(String(p._id))) ||
        (p.seatId && existingPaxBySeat.get(p.seatId)) ||
        null

      if (isMaskedOrUnchangedAadhaar(paxObj.aadhar)) {
        if (matched && matched.aadhar) {
          paxObj.aadhar = matched.aadhar
          paxObj.aadharEncrypted = matched.aadharEncrypted !== undefined ? matched.aadharEncrypted : true
        } else {
          paxObj.aadhar = ""
          paxObj.aadharEncrypted = false
        }
      } else if (paxObj.aadhar && typeof paxObj.aadhar === "string" && paxObj.aadhar.trim().length > 0) {
        paxObj.aadhar = encryptAadhaar(paxObj.aadhar)
        paxObj.aadharEncrypted = true
      } else {
        paxObj.aadhar = ""
        paxObj.aadharEncrypted = false
      }
      return paxObj
    })

    assert.equal(updatedPax[0].aadhar, existingCiphertext, "Ciphertext should be preserved untouched")
    assert.equal(updatedPax[0].aadharEncrypted, true)
    assert.equal(decryptAadhaar(updatedPax[0].aadhar), rawAadhaar, "Decrypted value matches original")
    assert.notEqual(updatedPax[0].aadhar, "XXXX XXXX 5678", "Masked string must never be stored")
    assert.notEqual(updatedPax[0].aadhar, "[UNCHANGED]", "Sentinel must never be stored")
  })

  await t.test("Backend passenger reconciliation encrypts new Aadhaar when operator replaces it", () => {
    const existingPax = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        seatId: "lower-L1-1",
        aadhar: encryptAadhaar("999999990019"),
        aadharEncrypted: true,
      },
    ]

    const newRawAadhaar = "555555550017" // Verhoeff valid
    assert.equal(validateVerhoeff(newRawAadhaar), true)

    const incomingPassengers = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        seatId: "lower-L1-1",
        aadhar: newRawAadhaar,
      },
    ]

    const existingPaxById = new Map()
    for (const ep of existingPax) {
      if (ep._id) existingPaxById.set(String(ep._id), ep)
    }

    const updatedPax = incomingPassengers.map((p) => {
      const paxObj = { ...p }
      const matched = p._id ? existingPaxById.get(String(p._id)) : null

      if (isMaskedOrUnchangedAadhaar(paxObj.aadhar)) {
        if (matched && matched.aadhar) {
          paxObj.aadhar = matched.aadhar
          paxObj.aadharEncrypted = matched.aadharEncrypted !== undefined ? matched.aadharEncrypted : true
        } else {
          paxObj.aadhar = ""
          paxObj.aadharEncrypted = false
        }
      } else if (paxObj.aadhar && typeof paxObj.aadhar === "string" && paxObj.aadhar.trim().length > 0) {
        paxObj.aadhar = encryptAadhaar(paxObj.aadhar)
        paxObj.aadharEncrypted = true
      } else {
        paxObj.aadhar = ""
        paxObj.aadharEncrypted = false
      }
      return paxObj
    })

    assert.notEqual(updatedPax[0].aadhar, newRawAadhaar, "New raw Aadhaar must be encrypted")
    assert.equal(updatedPax[0].aadharEncrypted, true)
    assert.equal(decryptAadhaar(updatedPax[0].aadhar), newRawAadhaar)
  })

  await t.test("Backend passenger reconciliation clears Aadhaar when explicitly cleared", () => {
    const existingPax = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        seatId: "lower-L1-1",
        aadhar: encryptAadhaar("999999990019"),
        aadharEncrypted: true,
      },
    ]

    const incomingPassengers = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        seatId: "lower-L1-1",
        aadhar: "", // cleared by user
      },
    ]

    const existingPaxById = new Map()
    for (const ep of existingPax) {
      if (ep._id) existingPaxById.set(String(ep._id), ep)
    }

    const updatedPax = incomingPassengers.map((p) => {
      const paxObj = { ...p }
      const matched = p._id ? existingPaxById.get(String(p._id)) : null

      if (isMaskedOrUnchangedAadhaar(paxObj.aadhar)) {
        if (matched && matched.aadhar) {
          paxObj.aadhar = matched.aadhar
          paxObj.aadharEncrypted = matched.aadharEncrypted !== undefined ? matched.aadharEncrypted : true
        } else {
          paxObj.aadhar = ""
          paxObj.aadharEncrypted = false
        }
      } else if (paxObj.aadhar && typeof paxObj.aadhar === "string" && paxObj.aadhar.trim().length > 0) {
        paxObj.aadhar = encryptAadhaar(paxObj.aadhar)
        paxObj.aadharEncrypted = true
      } else {
        paxObj.aadhar = ""
        paxObj.aadharEncrypted = false
      }
      return paxObj
    })

    assert.equal(updatedPax[0].aadhar, "")
    assert.equal(updatedPax[0].aadharEncrypted, false)
  })

  await t.test("New passenger does not inherit existing passenger's Aadhaar", () => {
    const existingPax = [
      {
        _id: "pax_1",
        name: "Ramesh Patel",
        seatId: "lower-L1-1",
        aadhar: encryptAadhaar("999999990019"),
        aadharEncrypted: true,
      },
    ]

    const incomingPassengers = [
      {
        // New passenger, no _id match
        name: "Suresh Shah",
        seatId: "lower-L1-2",
        aadhar: "XXXX XXXX 9999", // Attempted spoof or bogus mask
      },
    ]

    const existingPaxById = new Map()
    const existingPaxBySeat = new Map()
    for (const ep of existingPax) {
      if (ep._id) existingPaxById.set(String(ep._id), ep)
      if (ep.seatId) existingPaxBySeat.set(ep.seatId, ep)
    }

    const updatedPax = incomingPassengers.map((p) => {
      const paxObj = { ...p }
      const matched =
        (p._id && existingPaxById.get(String(p._id))) ||
        (p.seatId && existingPaxBySeat.get(p.seatId)) ||
        null

      if (isMaskedOrUnchangedAadhaar(paxObj.aadhar)) {
        if (matched && matched.aadhar) {
          paxObj.aadhar = matched.aadhar
          paxObj.aadharEncrypted = matched.aadharEncrypted !== undefined ? matched.aadharEncrypted : true
        } else {
          paxObj.aadhar = ""
          paxObj.aadharEncrypted = false
        }
      } else if (paxObj.aadhar && typeof paxObj.aadhar === "string" && paxObj.aadhar.trim().length > 0) {
        paxObj.aadhar = encryptAadhaar(paxObj.aadhar)
        paxObj.aadharEncrypted = true
      } else {
        paxObj.aadhar = ""
        paxObj.aadharEncrypted = false
      }
      return paxObj
    })

    assert.equal(updatedPax[0].aadhar, "", "New passenger must not inherit Aadhaar from existing passenger")
    assert.equal(updatedPax[0].aadharEncrypted, false)
  })
})
