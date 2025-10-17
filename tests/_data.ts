export const NOW = Date.now();
export const user = {
  fullName: 'Test Korisnik',
  emailOk: `test.user.${NOW}@example.com`,
  emailBadNoAt: `test.user.${NOW}example.com`,
  passwordOk: 'Passw0rd!',
  passwordShort: '12345',
};
