const { createSlice } = require("@reduxjs/toolkit");

const gainSlice = createSlice({
  name: "gain",
  initialState: {
    pricePerPoster: 4.99,
    salesCount: 0,
    totalRevenue: 0,
  },
  reducers: {
    setSalePrice(state, action) {
      state.pricePerPoster = action.payload;
    },
    recordSale(state) {
      state.salesCount += 1;
      state.totalRevenue = Math.round((state.totalRevenue + state.pricePerPoster) * 100) / 100;
    },
  },
});

module.exports = {
  gainReducer: gainSlice.reducer,
  gainActions: gainSlice.actions,
};
