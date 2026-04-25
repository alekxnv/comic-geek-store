const fs = require("fs");

module.exports = async function () {
  const dir = global.__TEST_DATA_DIR__;
  if (dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
};
