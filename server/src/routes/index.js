export default [
  {
    method: 'GET',
    path: '/get-glossary-words',
    // name of the controller file & the method.
    handler: 'controller.getGlossaryWords',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/connect-glossary-words',
    // name of the controller file & the method.
    handler: 'controller.connectGlossaryWords',
    config: {
      policies: [],
    },
  },
  {
    method: 'POST',
    path: '/disconnect-glossary-words',
    // name of the controller file & the method.
    handler: 'controller.disconnectGlossaryWords',
    config: {
      policies: [],
    },
  },
];
