const { configureStore } = require("@reduxjs/toolkit");
const { botReducer } = require("./botSlice");
const { gainReducer } = require("./gainSlice");

const store = configureStore({
  reducer: {
    bot: botReducer,
    gain: gainReducer,
  },
});

module.exports = store;
