const {test}=require('node:test');const {execFileSync}=require('node:child_process');
test('Firebase Admin carrega em ambiente CommonJS sem require ESM experimental',()=>{execFileSync(process.execPath,['--no-experimental-require-module','-e',"require('firebase-admin/app');require('firebase-admin/auth');require('firebase-admin/database');"],{stdio:'pipe'});});
