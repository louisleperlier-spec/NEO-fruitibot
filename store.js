const { configureStore, createSlice } = require("@reduxjs/toolkit");

const GAIN_MIN = 0.5;
const GAIN_MAX = 2.0;
const GAIN_DEFAULT = 1.0;

const gainSlice = createSlice({
  name: "gain",
  initialState: {},
  reducers: {
    setGain(state, action) {
      const { userId, value } = action.payload;
      state[userId] = Math.min(GAIN_MAX, Math.max(GAIN_MIN, value));
    },
    resetGain(state, action) {
      const { userId } = action.payload;
      delete state[userId];
    },
  },
});

const store = configureStore({ reducer: { gain: gainSlice.reducer } });

function getUserGain(userId) {
  return store.getState().gain[userId] ?? GAIN_DEFAULT;
}

module.exports = {
  store,
  setGain: gainSlice.actions.setGain,
  resetGain: gainSlice.actions.resetGain,
  getUserGain,
  GAIN_MIN,
  GAIN_MAX,
  GAIN_DEFAULT,
};
