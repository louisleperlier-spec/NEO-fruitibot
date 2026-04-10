const { configureStore } = require("@reduxjs/toolkit");
const { botReducer } = require("./botSlice");

const store = configureStore({
  reducer: {
    bot: botReducer,
  },
});

module.exports = store;
