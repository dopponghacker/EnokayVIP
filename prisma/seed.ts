import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split("T")[0];

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

const adminUsername = process.env.ADMIN_USERNAME || "Enokay";
const adminPassword = process.env.ADMIN_PASSWORD || "Ghana22@";

const vipTips = [
  { tier: "accurate-odds", homeTeam: "Arsenal", awayTeam: "Chelsea", prediction: "Home Win & Over 2.5", league: "Premier League", time: "17:30", date: today, odds: "2.10" },
  { tier: "accurate-odds", homeTeam: "Barcelona", awayTeam: "Real Madrid", prediction: "BTTS Yes & Over 2.5", league: "La Liga", time: "20:00", date: today, odds: "1.95" },
  { tier: "draw-tips", homeTeam: "Juventus", awayTeam: "AC Milan", prediction: "Draw", league: "Serie A", time: "20:45", date: today, odds: "3.20" },
  { tier: "correct-score", homeTeam: "PSG", awayTeam: "Marseille", prediction: "2-1", league: "Ligue 1", time: "21:00", date: today, odds: "8.50" },
];

const publicMatches = [
  { homeTeam: "Arsenal", awayTeam: "Aston Villa", prediction: "Home Win", league: "Premier League", date: twoDaysAgo, time: "17:30", odds: "1.55", status: "won" },
  { homeTeam: "Barcelona", awayTeam: "Sevilla", prediction: "Over 2.5", league: "La Liga", date: twoDaysAgo, time: "20:00", odds: "1.70", status: "won" },
  { homeTeam: "Inter Milan", awayTeam: "Napoli", prediction: "BTTS Yes", league: "Serie A", date: twoDaysAgo, time: "20:45", odds: "1.80", status: "lost" },
  { homeTeam: "Man City", awayTeam: "Liverpool", prediction: "Draw", league: "Premier League", date: yesterday, time: "15:00", odds: "3.40", status: "won" },
  { homeTeam: "Real Madrid", awayTeam: "Atletico Madrid", prediction: "Home Win", league: "La Liga", date: yesterday, time: "21:00", odds: "1.65", status: "won" },
  { homeTeam: "Bayern Munich", awayTeam: "Leverkusen", prediction: "Over 2.5", league: "Bundesliga", date: yesterday, time: "18:30", odds: "1.75", status: "pending" },
];

async function main() {
  console.log("Seeding database...");

  // Upsert admin credentials
  const { hash, salt } = hashPassword(adminPassword);
  await prisma.adminCredential.upsert({
    where: { id: "admin" },
    update: { username: adminUsername, passwordHash: hash, passwordSalt: salt },
    create: { id: "admin", username: adminUsername, passwordHash: hash, passwordSalt: salt },
  });
  console.log(`Admin credential set (username: ${adminUsername})`);

  await prisma.vipTip.deleteMany();
  await prisma.publicMatch.deleteMany();

  for (const tip of vipTips) {
    await prisma.vipTip.create({ data: tip });
  }
  console.log(`Created ${vipTips.length} VIP tips`);

  for (const match of publicMatches) {
    await prisma.publicMatch.create({ data: match });
  }
  console.log(`Created ${publicMatches.length} public matches`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
