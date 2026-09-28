import { updateCompany } from "./auth"

export async function getCompanySettings(user) {
  return {
    companyName: user?.companyName || "XYZ Tourism",
    companyTagline: user?.companyTagline || "Tourism & Travels",
    companyHeadquarters: user?.companyHeadquarters || "City, State, 123456",
    companyPhone: user?.companyPhone || "+91 98765 43210",
    companyLogo: user?.companyLogo || "",
    organizers: user?.organizers || [],
  }
}

export async function updateCompanySettings(settings) {
  return updateCompany(settings)
}
