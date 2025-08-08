const express = require('express');
const multer  = require('multer');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'photos.json');

fse.ensureDirSync(UPLOAD_DIR);
fse.ensureDirSync(DATA_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf8');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function readDb(){
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return []; }
}
function writeDb(arr){
  fs.writeFileSync(DB_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

app.get('/api/photos', (req, res) => {
  const items = readDb().sort((a,b) => b.ts - a.ts);
  res.json(items);
});

app.post('/api/upload', upload.array('files', 20), (req, res) => {
  const friend = (req.body.friend || 'ללא שם').toString();
  const caption = (req.body.caption || '').toString();

  const db = readDb();
  const created = (req.files || []).map(f => {
    const it = {
      id: uuidv4(),
      friend,
      caption,
      filename: f.filename,
      url: '/uploads/' + f.filename,
      ts: Date.now()
    };
    db.push(it);
    return it;
  });
  writeDb(db);
  res.status(201).json(created);
});

app.delete('/api/photos/:id', (req, res) => {
  const id = req.params.id;
  const db = readDb();
  const idx = db.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({error:'not_found'});

  const [item] = db.splice(idx,1);
  writeDb(db);

  const filePath = path.join(UPLOAD_DIR, item.filename);
  fs.unlink(filePath, () => {});
  res.json({ok:true});
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:'+PORT);
});
