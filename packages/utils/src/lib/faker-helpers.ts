import { faker } from "@faker-js/faker"

export const schoolYear = () => faker.helpers.arrayElement([2122, 2223, 2324])
export const deployEnv = () => faker.helpers.arrayElement(['prod', 'test', 'dev'])
export const schoolType = () => faker.helpers.arrayElement(['Unified', 'High', 'Middle', 'Elementary', 'Junior High', 'Senior High']) + faker.helpers.arrayElement(['', '', ' School'])
export const districtName = () => faker.address.cityName() + faker.helpers.arrayElement(['', '', ' Schools', ' Unified', ' School District'])