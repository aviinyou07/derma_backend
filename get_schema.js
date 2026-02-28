require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function getDbSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 3306
  });

  const dbName = process.env.DB_DATABASE;
  const output = {
    database: dbName,
    generatedAt: new Date().toISOString(),
    tables: []
  };

  try {
    const [tables] = await connection.query(
      `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, AUTO_INCREMENT
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'`,
      [dbName]
    );

    for (const table of tables) {
      const tableName = table.TABLE_NAME;

      const tableData = {
        name: tableName,
        engine: table.ENGINE,
        collation: table.TABLE_COLLATION,
        autoIncrement: table.AUTO_INCREMENT,
        columns: [],
        indexes: [],
        foreignKeys: [],
        checks: [],
        triggers: []
      };

      // Columns
      const [columns] = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=?
         ORDER BY ORDINAL_POSITION`,
        [dbName, tableName]
      );

      columns.forEach(col => {
        tableData.columns.push({
          name: col.COLUMN_NAME,
          type: col.COLUMN_TYPE,
          nullable: col.IS_NULLABLE === 'YES',
          key: col.COLUMN_KEY,
          extra: col.EXTRA,
          default: col.COLUMN_DEFAULT
        });
      });

      // Indexes (including composite)
      const [indexes] = await connection.query(
        `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=?
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [dbName, tableName]
      );

      const indexMap = {};
      indexes.forEach(idx => {
        if (!indexMap[idx.INDEX_NAME]) {
          indexMap[idx.INDEX_NAME] = {
            name: idx.INDEX_NAME,
            unique: idx.NON_UNIQUE === 0,
            columns: []
          };
        }
        indexMap[idx.INDEX_NAME].columns.push(idx.COLUMN_NAME);
      });

      tableData.indexes = Object.values(indexMap);

      // Foreign Keys + actions
      const [fks] = await connection.query(
        `SELECT k.COLUMN_NAME, 
                k.REFERENCED_TABLE_NAME, 
                k.REFERENCED_COLUMN_NAME,
                r.UPDATE_RULE, 
                r.DELETE_RULE
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
         JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r
           ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME
          AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
         WHERE k.TABLE_SCHEMA=? 
           AND k.TABLE_NAME=? 
           AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
        [dbName, tableName]
      );

      fks.forEach(fk => {
        tableData.foreignKeys.push({
          column: fk.COLUMN_NAME,
          references: `${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`,
          onUpdate: fk.UPDATE_RULE,
          onDelete: fk.DELETE_RULE
        });
      });

      // Check constraints
      const [checks] = await connection.query(
        `SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
         FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
         JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
           ON cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
         WHERE tc.TABLE_SCHEMA=? AND tc.TABLE_NAME=?`,
        [dbName, tableName]
      );

      tableData.checks = checks;

      // Triggers
      const [triggers] = await connection.query(
        `SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING
         FROM INFORMATION_SCHEMA.TRIGGERS
         WHERE EVENT_OBJECT_SCHEMA=? AND EVENT_OBJECT_TABLE=?`,
        [dbName, tableName]
      );

      tableData.triggers = triggers;

      output.tables.push(tableData);
    }

    await connection.end();

    // Save JSON
    fs.writeFileSync('schema.json', JSON.stringify(output, null, 2));

    // Generate Markdown
    let md = `# Database Schema - ${dbName}\n\n`;
    md += `Generated: ${new Date().toLocaleString()}\n\n`;
    md += "=".repeat(80) + "\n";

    output.tables.forEach(table => {
      md += `\n## TABLE: ${table.name}\n`;
      md += "-".repeat(80) + "\n";
      md += `Engine: ${table.engine} | Collation: ${table.collation} | Auto Increment: ${table.autoIncrement}\n\n`;

      md += "### Columns\n";
      table.columns.forEach((col, i) => {
        md += `${i + 1}. ${col.name} (${col.type})`;
        if (!col.nullable) md += " [NOT NULL]";
        if (col.key === 'PRI') md += " [PRIMARY KEY]";
        if (col.key === 'UNI') md += " [UNIQUE]";
        if (col.default !== null) md += ` [DEFAULT: ${col.default}]`;
        md += "\n";
      });

      if (table.indexes.length) {
        md += "\n### Indexes\n";
        table.indexes.forEach(idx => {
          md += `- ${idx.name} (${idx.columns.join(', ')})`;
          if (idx.unique) md += " [UNIQUE]";
          md += "\n";
        });
      }

      if (table.foreignKeys.length) {
        md += "\n### Foreign Keys\n";
        table.foreignKeys.forEach(fk => {
          md += `- ${fk.column} → ${fk.references} (ON UPDATE ${fk.onUpdate}, ON DELETE ${fk.onDelete})\n`;
        });
      }

      if (table.checks.length) {
        md += "\n### Check Constraints\n";
        table.checks.forEach(c => {
          md += `- ${c.CONSTRAINT_NAME}: ${c.CHECK_CLAUSE}\n`;
        });
      }

      if (table.triggers.length) {
        md += "\n### Triggers\n";
        table.triggers.forEach(t => {
          md += `- ${t.TRIGGER_NAME} (${t.ACTION_TIMING} ${t.EVENT_MANIPULATION})\n`;
        });
      }

      md += "\n";
    });

    md += "=".repeat(80) + "\n";

    fs.writeFileSync('DATABASE_SCHEMA.md', md);

    console.log("Generated schema output:", md);

    console.log("✅ Schema exported to:");
    console.log("   - schema.json");
    console.log("   - DATABASE_SCHEMA.md");

  } catch (err) {
    console.error("Error:", err.message);
    await connection.end();
  }
}

getDbSchema();