// app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const hostname = '127.0.0.1';
const app = express();
const PORT = process.env.PORT || 3000;



app.use(cors());
app.use(express.json());

// Testataan että palvelin toimii
app.get("/", (req, res) => {
  res.json({ message: "CardioRest backend toimii" });
});

app.listen(PORT, hostname, () => {
  console.log(`Palvelin käynnissä portissa http://${hostname}:${PORT}/`);
});
