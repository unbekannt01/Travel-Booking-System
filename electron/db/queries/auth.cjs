const { getAllSettings, updateSettings } = require("./settings.cjs")

function getOperatorSession(db) {
  const settings = getAllSettings(db)

  const user = {
    id: "local-operator",
    _id: "local-operator",
    userName: settings.operatorName || "Admin Operator",
    email: settings.operatorEmail || "operator@yatrahub.local",
    companyName: settings.companyName || "XYZ Tourism",
    companyTagline: settings.companyTagline,
    companyHeadquarters: settings.companyHeadquarters,
    companyPhone: settings.companyPhone,
    companyLogo: settings.companyLogo,
    organizers: settings.organizers,
    role: "admin",
    is2FAEnabled: false,
  }

  return {
    token: "desktop-offline-operator-token",
    tokenId: "desktop-offline-session",
    user,
  }
}

function updateProfile(db, userName) {
  updateSettings(db, { operatorName: userName })
  return getOperatorSession(db)
}

module.exports = {
  getOperatorSession,
  updateProfile,
}
