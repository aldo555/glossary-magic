import { GlossaryMagicButton } from './components/GlossaryMagicButton';

export default {
  register(app) {
  },
  bootstrap(app) {
    app.getPlugin('content-manager').apis.addEditViewSidePanel([GlossaryMagicButton])
  },
};
