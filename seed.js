// seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sampleData = [
    { company: "google", role: "SDE", level_standardized: "L3", location: "Hyderabad", experience_years: 1, base_salary: 1800000, bonus: 200000, stock: 100000, total_compensation: 2100000 },
    { company: "microsoft", role: "SDE II", level_standardized: "L4", location: "Bangalore", experience_years: 4, base_salary: 2800000, bonus: 400000, stock: 600000, total_compensation: 3800000 },
    { company: "amazon", role: "SDE", level_standardized: "L4", location: "Chennai", experience_years: 2, base_salary: 2200000, bonus: 0, stock: 200000, total_compensation: 2400000 },
  ];

  for (const data of sampleData) {
    await prisma.salary.create({ data });
  }
  console.log("Sample data inserted");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());