import App from "./App.vue";
import routerOption from "./router-option";

const connector = (options) => {
  const { App, routerOption, beforeEach, afterEach, storeModule } = options;

  return ({ root, store, Vue, VueRouter, name }) => {
    if (storeModule) {
      store.registerModule(name, {
        ...storeModule,
        namespaced: true
      });
    }
    const router = new VueRouter(routerOption)

    if (beforeEach) {
      router.beforeEach(beforeEach)
    }

    if (afterEach) {
      router.afterEach(afterEach)
    }

    const instance = new Vue({
      render: h => h(App),
      router,
      store,
    }).$mount();
    root.appendChild(instance.$el)
    document.body.classList.add(name)

    return () => {
      instance.$destroy();
      root.removeChild(instance.$el)
      document.body.classList.remove(name)
      if (storeModule) {
        store.unregisterModule(name);
      }
    };
  };
};

export default connector({
  App,
  routerOption,
  storeModule: {
    state () {
      return {
        deviceList: [
          {
            name: "dsdasda"
          }
        ]
      };
    }
  }
});
