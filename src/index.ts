import { createServer } from 'http';
import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 5000;

// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'FSD_2022_BARORO',
//   password: '52545658',
//   port: 5432,
// });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || ''),
});

app.use(cors());
app.use(express.json());

const setupDatabase = async () => {
  try {
    // Check and create users table
    const usersTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      );
    `);

    if (!usersTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          uuid UUID UNIQUE NOT NULL,
          os VARCHAR(10) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // Check and create transactions table
    const transactionsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'transactions'
      );
    `);

    if (!transactionsTableCheck.rows[0].exists) {
      await pool.query(`
        CREATE TABLE transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          calculation VARCHAR(255) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  } catch (err) {
    console.error('Error setting up database:', err);
  }
};

setupDatabase();

app.post('/app/user', async (req: Request, res: Response) => {
  const { os } = req.body;

  if (!os || !['ios', 'android'].includes(os)) {
    return res.status(400).json({ error: 'Invalid body parameter' });
  }

  // Generate a UUID for the new user
  const uuid = uuidv4();

  try {
    const result = await pool.query(
      'INSERT INTO users (uuid, os) VALUES ($1, $2) RETURNING uuid',
      [uuid, os]
    );
    res.status(200).json({ user: { uuid: result.rows[0].uuid } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// Add this endpoint to your src/index.ts file
app.get('/app/user/:userUUID', async (req: Request, res: Response) => {
  const { userUUID } = req.params;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE uuid = $1', [
      userUUID,
    ]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user: userResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.post('/app/user/:uid/transaction', async (req: Request, res: Response) => {
  const { uid } = req.params;
  const { calculation } = req.body;

  if (!calculation) {
    return res.status(400).json({ error: 'Invalid body parameter' });
  }

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE uuid = $1',
      [uid]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;
    await pool.query(
      'INSERT INTO transactions (user_id, calculation) VALUES ($1, $2)',
      [userId, calculation]
    );
    res.status(200).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.get('/app/user/:uid/transaction', async (req: Request, res: Response) => {
  const { uid } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE uuid = $1',
      [uid]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;
    const transactionsResult = await pool.query(
      'SELECT calculation FROM transactions WHERE user_id = $1',
      [userId]
    );

    res.status(200).json({ transactions: transactionsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.delete(
  '/app/user/:uid/transaction',
  async (req: Request, res: Response) => {
    const { uid } = req.params;

    try {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE uuid = $1',
        [uid]
      );

      if (userResult.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userId = userResult.rows[0].id;
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      res.status(204).json({});
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'An error occurred' });
    }
  }
);

app.post('/app/reset', async (req: Request, res: Response) => {
  try {
    // Drop the transactions table
    await pool.query('DROP TABLE IF EXISTS transactions');

    // Call the setupDatabase function to recreate the tables
    await setupDatabase();

    res.status(200).json({ message: 'Database reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
});

/* app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); */

const server = createServer(app);
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export { app };
