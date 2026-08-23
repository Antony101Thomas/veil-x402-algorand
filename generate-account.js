const algosdk = require("algosdk");
const account = algosdk.generateAccount();

console.log("Address:", account.addr.toString());
console.log("Mnemonic:", algosdk.secretKeyToMnemonic(account.sk));
