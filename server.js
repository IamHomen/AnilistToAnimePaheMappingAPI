import express from 'express';
import episodesRoute from './routes/episodes.js';

const app = express();

app.use("/api/episodes", episodesRoute);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
