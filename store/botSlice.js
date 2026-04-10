const { createSlice } = require("@reduxjs/toolkit");

const botSlice = createSlice({
  name: "bot",
  initialState: {
    status: "idle",
    activeGenerations: [],
    stats: {
      totalGenerated: 0,
      errors: 0,
    },
  },
  reducers: {
    setBotStatus(state, action) {
      state.status = action.payload;
    },
    generationStarted(state, action) {
      const chatId = action.payload;
      if (!state.activeGenerations.includes(chatId)) {
        state.activeGenerations.push(chatId);
      }
    },
    generationFinished(state, action) {
      const chatId = action.payload;
      state.activeGenerations = state.activeGenerations.filter((id) => id !== chatId);
      state.stats.totalGenerated += 1;
    },
    generationFailed(state, action) {
      const chatId = action.payload;
      state.activeGenerations = state.activeGenerations.filter((id) => id !== chatId);
      state.stats.errors += 1;
    },
  },
});

module.exports = {
  botReducer: botSlice.reducer,
  botActions: botSlice.actions,
};
