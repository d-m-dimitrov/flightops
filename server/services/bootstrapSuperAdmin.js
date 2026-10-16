const bcrypt = require('bcryptjs');
const User = require('../models/User');
// Runs only when the operator configures a bootstrap email in the hosting environment.
// Existing accounts/passwords are never silently promoted or reset.
module.exports = async function bootstrapSuperAdmin(env = process.env) {
  if (!env.SUPER_ADMIN_EMAIL && !env.SUPER_ADMIN_PASSWORD) return;
  const email = String(env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Set a valid SUPER_ADMIN_EMAIL in the hosting environment');
  const admins = await User.find({role:'ADMIN'}).select('email active').limit(2);
  if (admins.length > 1) throw Error('Multiple admin accounts exist. Resolve them before enabling the single Super Admin setup');
  if (admins.length) {
    if (admins[0].email?.toLowerCase() !== email || !admins[0].active) throw Error('A different or inactive Super Admin already exists. No account was changed');
    console.log('Super Admin account already configured');
    return;
  }
  const password = env.SUPER_ADMIN_PASSWORD;
  if (typeof password !== 'string' || password.length < 16) throw Error('Set SUPER_ADMIN_PASSWORD to a unique password of at least 16 characters');
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if (await User.exists({email:{$regex:`^${escaped}$`,$options:'i'}})) throw Error('That email belongs to an existing account. Use a separate Super Admin email');
  await User.collection.createIndex({role:1},{unique:true,partialFilterExpression:{role:'ADMIN'},name:'single_super_admin'});
  await User.create({name:String(env.SUPER_ADMIN_NAME || 'Super Admin').trim().slice(0,100),email,
    passwordHash:await bcrypt.hash(password,12),active:true,role:'ADMIN',department:'OPERATIONS',position:'OPERATIONS_DM',skills:[],airlineQualifications:[]});
  console.log('Super Admin account created. Remove SUPER_ADMIN_PASSWORD from the hosting environment');
};
