// app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import kubiosRouter from './routes/kubios.js';

dotenv.config();

const hostname = '127.0.0.1';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/kubios', kubiosRouter);



// Testataan että palvelin toimii
app.get("/", (req, res) => {
  res.json({ message: "CardioRest backend toimii" });
});

app.listen(PORT, hostname, () => {
  console.log(`Palvelin käynnissä portissa http://${hostname}:${PORT}/`);
});
