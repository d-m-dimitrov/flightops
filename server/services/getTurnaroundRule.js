const Rule = require("../models/TurnaroundRule");
const normalize = value => String(value || "").trim().toUpperCase();

module.exports = async function resolveMgt(airline, aircraftType) {
  const airlineCode = normalize(airline), type = normalize(aircraftType);
  if (!airlineCode || !type) throw new Error("Airline and aircraft type are required for MGT");
  // Normalize legacy records too; do not silently choose between conflicting rules.
  const matches = (await Rule.find()).filter(rule =>
    normalize(rule.airline) === airlineCode && normalize(rule.aircraftType) === type);
  if (matches.length > 1) throw new Error(`Duplicate turnaround rules for ${airlineCode}/${type}`);
  const rule = matches[0];
  const mgt = rule ? rule.minimumGroundTime : 75;
  if (!Number.isInteger(mgt) || mgt <= 0) throw new Error("MGT must be a positive whole number of minutes");
  return { mgt, mgtSource: rule ? "rule" : "fallback", mgtRuleId: rule ? rule._id : null };
};
