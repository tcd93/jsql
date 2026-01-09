import { describe, it, expect } from "vitest";
import { splitSqlQueries } from "../../utils";

describe("splitSqlQueries", () => {
  describe("Basic functionality", () => {
    it("should return empty array for empty string", () => {
      const result = splitSqlQueries("");
      expect(result).toEqual([]);
    });

    it("should return empty array for whitespace-only string", () => {
      const result = splitSqlQueries("   \n\t  \n  ");
      expect(result).toEqual([]);
    });

    it("should parse single query without semicolon", () => {
      const sql = "SELECT * FROM users";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(sql.length);
    });

    it("should parse single query with semicolon", () => {
      const sql = "SELECT * FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(sql.length);
    });

    it("should parse multiple queries separated by semicolons", () => {
      const sql = "SELECT * FROM users; SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });

    it("should parse multiple queries with whitespace between them", () => {
      const sql = "SELECT * FROM users;  \n\n  SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });
  });

  describe("String literal handling", () => {
    it("should not split on semicolon inside single-quoted string", () => {
      const sql = "SELECT 'test;data' FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should not split on semicolon inside double-quoted string", () => {
      const sql = 'SELECT "test;data" FROM users;';
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle escaped single quotes with backslash", () => {
      const sql = "SELECT 'test\\'s;data' FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle escaped double quotes with backslash", () => {
      const sql = 'SELECT "test\\"data;here" FROM users;';
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle doubled single quotes (SQL standard escape)", () => {
      const sql = "SELECT 'test''s;data' FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle doubled double quotes", () => {
      const sql = 'SELECT "test""data;here" FROM users;';
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle multiple strings with semicolons", () => {
      const sql = "SELECT 'a;b', \"c;d\", 'e;f' FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });
  });

  describe("Line comment handling", () => {
    it("should not split on semicolon in line comment", () => {
      const sql = "SELECT * FROM users; -- this is a comment; with semicolons;";
      const result = splitSqlQueries(sql);

      // The query is trimmed so the comment part after semicolon is removed
      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });

    it("should handle query after line comment", () => {
      const sql = "SELECT * FROM users; -- comment\nSELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });

    it("should handle line comment at start of query", () => {
      const sql = "-- Initial comment\nSELECT * FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });

    it("should ignore query that is only comments", () => {
      const sql = "SELECT * FROM users; -- just a comment;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });

    it("should handle line comment between queries without semicolons", () => {
      const sql = "SELECT * FROM users -- inline comment\nSELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("SELECT * FROM users");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle line comment at end of query without semicolon", () => {
      const sql = "SELECT * FROM users -- end comment\nSELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("users -- end comment");
      expect(result[1].query).toContain("SELECT * FROM orders");
    });
  });

  describe("Block comment handling", () => {
    it("should not split on semicolon in block comment", () => {
      const sql = "SELECT * /* comment; with; semicolons */ FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle multiline block comment", () => {
      const sql =
        "SELECT * /* comment\n with semicolon; \n here */ FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle multiple block comments", () => {
      const sql = "SELECT /* c1; */ * /* c2; */ FROM users;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle block comment spanning multiple queries", () => {
      const sql = "SELECT * FROM users; /* comment; */ SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });

    it("should handle block comment between queries without semicolons", () => {
      const sql = "SELECT * FROM users /* comment */ SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users /* comment */");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle multiline block comment without semicolons", () => {
      const sql = `SELECT * FROM users
      /* multiline
         comment here */
      SELECT * FROM orders`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("SELECT");
      expect(result[1].query).toContain("SELECT * FROM orders");
    });
  });

  describe("Position tracking", () => {
    it("should track positions correctly for single query", () => {
      const sql = "SELECT * FROM users;";
      const result = splitSqlQueries(sql);

      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(20);
    });

    it("should track positions correctly for multiple queries", () => {
      const sql = "SELECT * FROM users; SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(20);
      expect(result[1].startPosition).toBe(21);
      expect(result[1].endPosition).toBe(42); // Fixed: actual end position
    });

    it("should track positions with leading whitespace", () => {
      const sql = "  \n  SELECT * FROM users;";
      const result = splitSqlQueries(sql);

      expect(result[0].startPosition).toBe(5); // position after whitespace
      expect(result[0].endPosition).toBe(25);
    });

    it("should track positions with whitespace between queries", () => {
      const sql = "SELECT * FROM users;\n\n   SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(20);
      expect(result[1].startPosition).toBe(25); // position after whitespace
      expect(result[1].endPosition).toBe(46);
    });

    it("should track positions with comments before query", () => {
      const sql = "  -- comment\n  SELECT * FROM users;";
      const result = splitSqlQueries(sql);

      expect(result[0].startPosition).toBe(15); // position of 'S' in SELECT
      expect(result[0].endPosition).toBe(35);
    });

    it("should track positions for queries without semicolons", () => {
      const sql = "SELECT * FROM users SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(19); // Excludes trailing whitespace
      expect(result[1].startPosition).toBe(20);
      expect(result[1].endPosition).toBe(40);
    });

    it("should track positions with whitespace between queries without semicolons", () => {
      const sql = "SELECT * FROM users\n\n   SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].startPosition).toBe(0);
      expect(result[0].endPosition).toBe(19); // Excludes trailing newlines/whitespace
      expect(result[1].startPosition).toBe(24);
      expect(result[1].endPosition).toBe(44);
    });
  });

  describe("Comment-only queries", () => {
    it("should skip query that contains only line comments", () => {
      const sql = "-- just a comment;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(0);
    });

    it("should skip query that contains only block comments", () => {
      const sql = "/* just a comment */;";
      const result = splitSqlQueries(sql);

      // Should be filtered out as it's only comments
      expect(result).toHaveLength(0);
    });

    it("should skip comment-only queries between real queries", () => {
      const sql = "SELECT * FROM users; -- comment only; SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });

    it("should skip comment-only sections between queries without semicolons", () => {
      const sql =
        "SELECT * FROM users\n-- just a comment\nSELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users\n-- just a comment");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle multiple comment blocks without semicolons", () => {
      const sql = `-- Header comment
      SELECT * FROM users
      /* Block comment */
      SELECT * FROM orders
      -- Footer comment`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("SELECT");
      expect(result[1].query).toContain("SELECT * FROM orders");
    });
  });

  describe("Multiple semicolons", () => {
    it("should handle single query with multiple semicolons at end", () => {
      const sql = "SELECT * FROM users;;;";
      const result = splitSqlQueries(sql);

      // Extra semicolons are filtered out
      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });

    it("should handle single query with many semicolons at end", () => {
      const sql = "SELECT * FROM users;;;;;;";
      const result = splitSqlQueries(sql);

      // Only the actual query is returned
      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });

    it("should handle multiple queries each with multiple semicolons", () => {
      const sql = "SELECT * FROM users;;; SELECT * FROM orders;;;";
      const result = splitSqlQueries(sql);

      // Only the two real queries
      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });

    it("should handle semicolons with whitespace between them", () => {
      const sql = "SELECT * FROM users; ; ; SELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      // Semicolon-only queries are filtered out
      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });

    it("should handle multiple semicolons with newlines", () => {
      const sql = "SELECT * FROM users;\n;\n;\nSELECT * FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders;");
    });

    it("should handle query ending with multiple semicolons and whitespace", () => {
      const sql = "SELECT * FROM users;;;  \n\n  ";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users;");
    });
  });

  describe("Complex mixed scenarios", () => {
    it("should handle query with strings, line comments, and block comments", () => {
      const sql = `
        SELECT 
          'value;1' as col1, -- comment;
          /* block; */ 'value;2' as col2
        FROM users;
      `.trim();

      const result = splitSqlQueries(sql);
      expect(result).toHaveLength(1);
    });

    it("should handle nested comment-like patterns in strings", () => {
      const sql =
        "SELECT '/* not a comment; */' FROM users; SELECT '--also not' FROM orders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
    });

    it("should handle real-world complex query", () => {
      const sql = `
        -- Query 1: User data
        SELECT 
          id,
          name,
          'status;active' as status /* inline comment; */
        FROM users
        WHERE email LIKE '%@example.com'; -- end of query 1
        
        /* 
         * Query 2: Order data
         * with semicolons; in comment
         */
        SELECT * FROM orders;
      `.trim();

      const result = splitSqlQueries(sql);
      expect(result).toHaveLength(2);
    });

    it("should handle tabs and various whitespace", () => {
      const sql = "SELECT\t*\tFROM\tusers;\t\n\t\nSELECT\t*\tFROM\torders;";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle query ending without semicolon", () => {
      const sql = "SELECT * FROM users; SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle single semicolon", () => {
      const sql = ";";
      const result = splitSqlQueries(sql);

      // A lone semicolon should be filtered out
      expect(result).toHaveLength(0);
    });

    it("should handle only whitespace and semicolons", () => {
      const sql = "  ;  \n ;  \t ; ";
      const result = splitSqlQueries(sql);

      // All semicolon-only queries should be filtered out
      expect(result).toHaveLength(0);
    });

    it("should handle unclosed string at end", () => {
      const sql = "SELECT 'unclosed";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle unclosed block comment at end", () => {
      const sql = "SELECT * FROM users /* unclosed comment";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle very long query", () => {
      const columns = Array.from({ length: 100 }, (_, i) => `col${i}`).join(
        ", "
      );
      const sql = `SELECT ${columns} FROM users;`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should preserve query text exactly as written", () => {
      const sql = "SELECT  *  FROM   users  ;  SELECT\n*\nFROM\norders;";
      const result = splitSqlQueries(sql);

      expect(result[0].query).toBe("SELECT  *  FROM   users  ;");
      expect(result[1].query).toBe("SELECT\n*\nFROM\norders;");
    });

    it("should handle DML statements without semicolons", () => {
      const sql =
        "INSERT INTO users VALUES (1) UPDATE users SET active = 1 DELETE FROM temp";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe("INSERT INTO users VALUES (1)");
      expect(result[1].query).toBe("UPDATE users SET active = 1");
      expect(result[2].query).toBe("DELETE FROM temp");
    });

    it("should handle empty queries between semicolons", () => {
      const sql = "SELECT * FROM users;;;SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle statements starting with whitespace", () => {
      const sql = "   SELECT * FROM users   ;   INSERT INTO logs VALUES (1)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users   ;");
      expect(result[1].query.trim()).toBe("INSERT INTO logs VALUES (1)");
    });

    it("should handle multiple consecutive DML statements", () => {
      const sql =
        "INSERT INTO a VALUES (1); UPDATE b SET x = 1; DELETE FROM c; MERGE INTO d USING e ON d.id = e.id WHEN MATCHED THEN UPDATE SET d.val = e.val";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(4);
      expect(result[0].query).toBe("INSERT INTO a VALUES (1);");
      expect(result[1].query).toBe("UPDATE b SET x = 1;");
      expect(result[2].query).toBe("DELETE FROM c;");
      expect(result[3].query).toContain("MERGE INTO d");
    });

    it("should handle CTE followed by multiple statements", () => {
      const sql =
        "WITH cte AS (SELECT 1) SELECT * FROM cte INSERT INTO logs VALUES (1) UPDATE users SET active = 1";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toContain("WITH cte");
      expect(result[0].query).toContain("SELECT * FROM cte");
      expect(result[1].query).toBe("INSERT INTO logs VALUES (1)");
      expect(result[2].query).toBe("UPDATE users SET active = 1");
    });

    it("should handle INSERT with SELECT subquery", () => {
      const sql =
        "INSERT INTO users (id, name) SELECT * FROM (SELECT id FROM temp) AS t";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle INSERT with SELECT and UNION ALL", () => {
      const sql = `WITH temp AS (SELECT id, name FROM temp) 
        INSERT INTO users (id, name) SELECT id, name FROM temp 
        UNION ALL SELECT id, name FROM orders
        UNION SELECT 1, 2`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle UPDATE with nested SELECT subqueries", () => {
      const sql =
        "UPDATE users SET col = (SELECT val FROM (SELECT val FROM temp) AS t) WHERE id IN (SELECT id FROM orders)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle DELETE with subquery", () => {
      const sql =
        "DELETE FROM users WHERE id IN (SELECT id FROM orders WHERE active = 1)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle MERGE with complex subqueries", () => {
      const sql =
        "MERGE INTO target USING (SELECT id, val FROM (SELECT id, val FROM source) AS s) AS t ON target.id = t.id WHEN MATCHED THEN UPDATE SET target.val = t.val";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle string with semicolon-like patterns", () => {
      const sql = `SELECT 'text;with;semicolons' FROM users; INSERT INTO logs VALUES ('more;text')`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("SELECT 'text;with;semicolons'");
      expect(result[1].query).toContain("INSERT INTO logs");
    });

    it("should handle comments between DML statements", () => {
      const sql =
        "INSERT INTO users VALUES (1); -- comment\nUPDATE users SET active = 1; /* block comment */ DELETE FROM temp";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe("INSERT INTO users VALUES (1);");
      expect(result[1].query).toContain("UPDATE users SET active = 1");
      expect(result[2].query).toContain("DELETE FROM temp");
    });

    it("should handle table hints in UPDATE statements", () => {
      const sql = "UPDATE users WITH (NOLOCK) SET active = 1";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle FROM clause in UPDATE statements", () => {
      const sql =
        "UPDATE u SET u.active = 1 FROM users u INNER JOIN orders o ON u.id = o.user_id";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle OUTPUT clause in INSERT statements", () => {
      const sql = "INSERT INTO users OUTPUT INSERTED.id VALUES (1)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle OUTPUT clause in UPDATE statements", () => {
      const sql = "UPDATE users SET active = 1 OUTPUT INSERTED.id WHERE id = 1";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle OUTPUT clause in DELETE statements", () => {
      const sql = "DELETE FROM users OUTPUT DELETED.id WHERE id = 1";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle CASE statements in UPDATE SET clause", () => {
      const sql =
        "UPDATE users SET status = CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle multiple CTEs", () => {
      const sql =
        "WITH cte1 AS (SELECT 1), cte2 AS (SELECT 2) SELECT cte1.*, cte2.* FROM cte1 CROSS JOIN cte2";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle CTE with INSERT and multiple CTEs", () => {
      const sql =
        "WITH cte1 AS (SELECT 1), cte2 AS (SELECT 2) INSERT INTO logs SELECT * FROM cte1";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle very long DML statement", () => {
      const setClause = Array.from(
        { length: 50 },
        (_, i) => `col${i} = ${i}`
      ).join(", ");
      const sql = `UPDATE users SET ${setClause} WHERE id = 1`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle statement with only comments and whitespace", () => {
      const sql = "-- comment\n/* block */\n  \t  ";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(0);
    });

    it("should handle GO batch separator without statements", () => {
      const sql = "GO GO GO";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(0);
    });

    it("should handle statement boundary detection at start of text", () => {
      const sql = "SELECT * FROM users";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].startPosition).toBe(0);
    });

    it("should handle statement boundary detection after whitespace", () => {
      const sql = "   INSERT INTO users VALUES (1)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].startPosition).toBeGreaterThan(0);
      expect(result[0].query.trim()).toBe("INSERT INTO users VALUES (1)");
    });

    it("should split on SELECT keywords at top level", () => {
      const sql = "SELECT * FROM users SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should not split on SELECT in subquery", () => {
      const sql = "SELECT * FROM (SELECT id FROM users) AS u";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should handle mixed DML queries without semicolons", () => {
      const sql = `SELECT * FROM users
      INSERT INTO logs VALUES (1)
      UPDATE users SET active = 1 WHERE something IN (911, 912)
      DELETE FROM temp WHERE number IN (911, 912)
      DELETE FROM temp2 WHERE number IN (911, 912)`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(5);
      expect(result[0].query).toBe("SELECT * FROM users");
      expect(result[1].query).toBe("INSERT INTO logs VALUES (1)");
      expect(result[2].query).toBe(
        "UPDATE users SET active = 1 WHERE something IN (911, 912)"
      );
      expect(result[3].query).toBe(
        "DELETE FROM temp WHERE number IN (911, 912)"
      );
      expect(result[4].query).toBe(
        "DELETE FROM temp2 WHERE number IN (911, 912)"
      );
    });

    it("should trim trailing whitespace and newlines from query text", () => {
      const sql = `DELETE tmp
        FROM #tmpProductBettype tmp
        WHERE tmp.Bettype IN (911, 912)


      DELETE tmp
    FROM #tmpProductBettype tmp
    WHERE tmp.SubProduct IN ('BT-Sold', 'BT-Bought')
      
    `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("WHERE tmp.Bettype IN (911, 912)");
      expect(result[1].query).toContain(
        "WHERE tmp.SubProduct IN ('BT-Sold', 'BT-Bought')"
      );
      expect(result[0].query).not.toMatch(/\s+$/);
      expect(result[1].query).not.toMatch(/\s+$/);
    });

    it("should handle WITH (CTE) SELECT as statement start", () => {
      const sql =
        "WITH cte AS (SELECT 1) SELECT * FROM cte; SELECT * FROM users";
      const result = splitSqlQueries(sql);

      // First query includes WITH and its SELECT, second is the standalone SELECT
      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("WITH cte AS (SELECT 1) SELECT * FROM cte;");
      expect(result[1].query).toBe("SELECT * FROM users");
    });

    it("should handle WITH (CTE) INSERT as statement start", () => {
      const sql =
        "WITH cte AS (SELECT 1) INSERT INTO logs SELECT * FROM cte; DELETE FROM users";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe(
        "WITH cte AS (SELECT 1) INSERT INTO logs SELECT * FROM cte;"
      );
      expect(result[1].query).toBe("DELETE FROM users");
    });

    it("should handle WITH (CTE) UPDATE as statement start", () => {
      const sql =
        "WITH x AS (SELECT id, val FROM dbo.TestData WHERE id = 1) UPDATE x SET val = 'updated' DELETE FROM users";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe(
        "WITH x AS (SELECT id, val FROM dbo.TestData WHERE id = 1) UPDATE x SET val = 'updated'"
      );
      expect(result[1].query).toBe("DELETE FROM users");
    });

    it("should ignore CREATE statements", () => {
      const sql = "CREATE TABLE users (id INT) SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM orders");
    });

    it("should handle mixed semicolons and keywords", () => {
      const sql =
        "SELECT * FROM users; SELECT * FROM orders UPDATE products SET price = 10";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT * FROM orders");
      expect(result[2].query).toBe("UPDATE products SET price = 10");
    });

    it("should handle GO batch separator (T-SQL)", () => {
      const sql = "SELECT * FROM users GO SELECT * FROM orders";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users GO");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should ignore EXEC/EXECUTE statements", () => {
      const sql = "EXEC sp_help EXECUTE sp_who2";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(0);
    });

    it("should not treat table hints WITH (NOLOCK) as statement boundary", () => {
      const sql =
        "SELECT * FROM users WITH (NOLOCK) SELECT * FROM orders WITH (READUNCOMMITTED)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users WITH (NOLOCK)");
      expect(result[1].query).toBe(
        "SELECT * FROM orders WITH (READUNCOMMITTED)"
      );
    });

    it("should handle table aliases without splitting", () => {
      const sql =
        "SELECT u.id, o.total FROM users u JOIN orders o ON u.id = o.user_id SELECT * FROM products";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe(
        "SELECT u.id, o.total FROM users u JOIN orders o ON u.id = o.user_id"
      );
      expect(result[1].query).toBe("SELECT * FROM products");
    });

    it("should handle table aliases with AS keyword", () => {
      const sql =
        "SELECT u.name FROM users AS u WHERE u.active = 1 SELECT p.name FROM products AS p";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe(
        "SELECT u.name FROM users AS u WHERE u.active = 1"
      );
      expect(result[1].query).toBe("SELECT p.name FROM products AS p");
    });

    it("should handle multiple table hints in single query", () => {
      const sql =
        "SELECT * FROM users WITH (NOLOCK) JOIN orders WITH (READUNCOMMITTED) ON users.id = orders.user_id";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("WITH (NOLOCK)");
      expect(result[0].query).toContain("WITH (READUNCOMMITTED)");
    });

    it("should handle table hints without WITH keyword (deprecated syntax)", () => {
      const sql =
        "SELECT * FROM users (NOLOCK) SELECT * FROM orders (READUNCOMMITTED)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("users (NOLOCK)");
      expect(result[1].query).toContain("orders (READUNCOMMITTED)");
    });

    it("should handle mixed table aliases and table hints", () => {
      const sql =
        "SELECT u.id FROM users u WITH (NOLOCK) WHERE u.active = 1 SELECT o.total FROM orders o WITH (READUNCOMMITTED)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("users u WITH (NOLOCK)");
      expect(result[1].query).toContain("orders o WITH (READUNCOMMITTED)");
    });

    it("should handle table hints with multiple options", () => {
      const sql =
        "SELECT * FROM users WITH (NOLOCK, READPAST) SELECT * FROM orders WITH (ROWLOCK, UPDLOCK)";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("WITH (NOLOCK, READPAST)");
      expect(result[1].query).toContain("WITH (ROWLOCK, UPDLOCK)");
    });

    it("should handle complex query with aliases, hints, and JOINs followed by UPDATE", () => {
      const sql = `
        SELECT u.name, o.total, p.description
        FROM users u WITH (NOLOCK)
        INNER JOIN orders o WITH (READUNCOMMITTED) ON u.id = o.user_id
        LEFT JOIN products p (NOLOCK) ON o.product_id = p.id
        WHERE u.active = 1
        UPDATE users SET active = 0 WHERE id = 1
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("SELECT");
      expect(result[0].query).toContain("users u WITH (NOLOCK)");
      expect(result[0].query).toContain("orders o WITH (READUNCOMMITTED)");
      expect(result[1].query).toContain(
        "UPDATE users SET active = 0 WHERE id = 1"
      );
    });

    it("should handle MERGE statements and SELECT separately", () => {
      const sql = `MERGE INTO target_table AS t
        USING (
          SELECT (SELECT 1 FROM subquery) FROM source_table
        ) AS s ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET t.value = s.value
        WHEN NOT MATCHED THEN INSERT (id, value) VALUES (s.id, s.value)
        SELECT * FROM target_table`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("MERGE INTO target_table");
      expect(result[1].query).toContain("SELECT * FROM target_table");
    });

    it("should handle MERGE with semicolons", () => {
      const sql = `MERGE INTO inventory AS target
        USING updates AS source ON target.id = source.id
        WHEN MATCHED THEN UPDATE SET target.qty = source.qty;
        SELECT * FROM inventory;`;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("MERGE INTO inventory");
      expect(result[1].query).toContain("SELECT * FROM inventory");
    });

    it("should not split on MERGE in subquery", () => {
      const sql =
        "SELECT * FROM (SELECT id FROM users WHERE action = 'MERGE') AS merged";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe(sql);
    });

    it("should ignore TRUNCATE statements", () => {
      const sql = "TRUNCATE TABLE logs SELECT * FROM logs";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("SELECT * FROM logs");
    });

    it("should ignore DECLARE and extract only SELECT", () => {
      const sql = "DECLARE @var INT SET @var = 10 SELECT @var";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("SELECT @var");
    });

    it("should ignore USE and extract only SELECT", () => {
      const sql = "USE database_name SELECT * FROM users";
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("SELECT * FROM users");
    });

    it("should handle very large MERGE statement and SELECT separately", () => {
      // Create a MERGE statement that's much larger than 200 characters
      const largeConditions = Array.from(
        { length: 10 },
        (_, i) => `col${i} = source.col${i}`
      ).join(", ");
      const sql = `MERGE INTO target_table AS t
        USING (
          SELECT id, ${largeConditions},
                 extra_data_col1, extra_data_col2, extra_data_col3,
                 more_columns_here_to_make_it_long_enough_col4,
                 more_columns_here_to_make_it_long_enough_col5
          FROM source_table
          WHERE active = 1 AND status = 'ready'
        ) AS s ON t.id = s.id
        WHEN MATCHED THEN
          UPDATE SET ${largeConditions}
        WHEN NOT MATCHED THEN
          INSERT (id, ${largeConditions}) VALUES (s.id, ${largeConditions})
        SELECT * FROM target_table`;

      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("MERGE INTO target_table");
      expect(result[1].query).toContain("SELECT * FROM target_table");
    });

    it("should handle very large CTE statement and following INSERT separately", () => {
      // Create a CTE with a very large definition
      const largeColumns = Array.from({ length: 15 }, (_, i) => `col${i}`).join(
        ", "
      );
      const sql = `WITH large_cte AS (
          SELECT 
            ${largeColumns},
            additional_column_to_make_this_really_long_1,
            additional_column_to_make_this_really_long_2,
            additional_column_to_make_this_really_long_3,
            additional_column_to_make_this_really_long_4
          FROM source_table
          WHERE condition1 = 'value1'
            AND condition2 = 'value2'
            AND condition3 = 'value3'
        )
        SELECT * FROM large_cte WHERE col0 > 100
        INSERT INTO logs VALUES (1, 'done')`;

      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("WITH large_cte");
      expect(result[0].query).toContain("SELECT * FROM large_cte");
      expect(result[1].query).toContain("INSERT INTO logs VALUES (1, 'done')");
    });

    it("should handle very long UPDATE...SET statement and SELECT separately", () => {
      // Create an UPDATE with many columns to exceed the old 100-char lookback
      const setClause = Array.from(
        { length: 20 },
        (_, i) => `column_${i} = 'value_${i}'`
      ).join(", ");
      const sql = `UPDATE users_table_with_long_name SET ${setClause} WHERE id = 1 SELECT * FROM users`;

      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("SELECT * FROM users");
    });

    it("should ignore very long CREATE...WITH statement and extract SELECT", () => {
      // Create a CREATE TABLE with a long definition before WITH clause
      const sql = `CREATE TABLE my_very_long_table_name_that_exceeds_fifty_characters_easily (id INT) WITH (DATA_COMPRESSION = ROW) SELECT * FROM orders`;

      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("SELECT * FROM orders");
    });
  });

  describe("Working with T-SQL", () => {
    it("should handle TRY...CATCH blocks", () => {
      const sql = `
        BEGIN TRY
          SELECT * FROM users
        END TRY
        BEGIN CATCH
          PRINT 'Error occurred';
        END CATCH
        SELECT * FROM orders
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle IF ... ELSE statements", () => {
      const sql = `
        IF EXISTS (SELECT * FROM users) BEGIN
          SELECT 'Users exist'
        ELSE
          SELECT 'No users found'
        END
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT 'Users exist'");
      expect(result[1].query).toBe("SELECT 'No users found'");
    });

    it("should handle nested BEGIN...END blocks", () => {
      const sql = `
        BEGIN
          BEGIN
            SELECT * FROM users
          END
          BEGIN
            SELECT * FROM orders
          END
        END
        SELECT * FROM products
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe("SELECT * FROM users");
      expect(result[1].query).toBe("SELECT * FROM orders");
      expect(result[2].query).toBe("SELECT * FROM products");
    });

    it("should handle WHILE loops", () => {
      const sql = `
        WHILE (SELECT COUNT(*) FROM users) > 0
        BEGIN
          SELECT TOP 1 * FROM users
          DELETE TOP (1) FROM users
        END
        SELECT * FROM orders
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe("SELECT TOP 1 * FROM users");
      expect(result[1].query).toBe("DELETE TOP (1) FROM users");
      expect(result[2].query).toBe("SELECT * FROM orders");
    });

    it("should handle IF without ELSE", () => {
      const sql = `
        IF (SELECT COUNT(*) FROM users) > 0
        BEGIN
          SELECT * FROM users
        END
        SELECT * FROM orders
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users");
      expect(result[1].query).toBe("SELECT * FROM orders");
    });

    it("should handle IF...ELSE IF...ELSE chain", () => {
      const sql = `
        IF @status = 1
          SELECT 'Active'
        ELSE IF @status = 2
          SELECT 'Pending'
        ELSE
          SELECT 'Inactive'
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe("SELECT 'Active'");
      expect(result[1].query).toBe("SELECT 'Pending'");
      expect(result[2].query).toBe("SELECT 'Inactive'");
    });

    it("should ignore PRINT statements", () => {
      const sql = `
        PRINT 'Starting process'
        SELECT * FROM users
        PRINT 'Process complete'
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users");
    });

    it("should handle mixed control flow with CASE expressions", () => {
      const sql = `
        IF @type = 1
        BEGIN
          UPDATE users SET status = CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END
        END
        ELSE
        BEGIN
          SELECT status FROM users WHERE status IN ('active', 'inactive')
        END
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe(
        "UPDATE users SET status = CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END"
      );
      expect(result[1].query).toBe(
        "SELECT status FROM users WHERE status IN ('active', 'inactive')"
      );
    });

    it("should handle TRY...CATCH with multiple statements", () => {
      const sql = `
        BEGIN TRY
          SELECT * FROM users
          UPDATE users SET last_login = GETDATE()
          DELETE FROM logs WHERE created_at < DATEADD(day, -30, GETDATE())
        END TRY
        BEGIN CATCH
          SELECT ERROR_NUMBER() AS ErrorNumber
        END CATCH
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(4);
      expect(result[0].query).toBe("SELECT * FROM users");
      expect(result[1].query).toBe("UPDATE users SET last_login = GETDATE()");
      expect(result[2].query).toBe(
        "DELETE FROM logs WHERE created_at < DATEADD(day, -30, GETDATE())"
      );
      expect(result[3].query).toBe("SELECT ERROR_NUMBER() AS ErrorNumber");
    });

    it("should handle control flow keywords with semicolons", () => {
      const sql = `
        BEGIN TRY;
          SELECT * FROM users;
        END TRY;
        BEGIN CATCH;
          SELECT 'Error';
        END CATCH;
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toBe("SELECT * FROM users;");
      expect(result[1].query).toBe("SELECT 'Error';");
    });

    it("should not confuse CASE...END with control flow END", () => {
      const sql = `
        SELECT
          CASE status
            WHEN 1 THEN 'Active'
            ELSE 'Inactive'
          END AS status_text
        FROM users
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("CASE status");
      expect(result[0].query).toContain("END AS status_text");
    });

    it("should handle nested CASE in control flow", () => {
      const sql = `
        BEGIN
          SELECT
            CASE
              WHEN status = 1 THEN 'Active'
              ELSE 'Inactive'
            END
          FROM users
        END
        IF 1=1
          UPDATE orders SET status = CASE priority WHEN 1 THEN 'High' ELSE 'Low' END
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(2);
      expect(result[0].query).toContain("CASE");
      expect(result[0].query).toContain("END");
      expect(result[1].query).toContain(
        "UPDATE orders SET status = CASE priority WHEN 1 THEN 'High' ELSE 'Low' END"
      );
    });

    it("should handle WHILE with CASE expression", () => {
      const sql = `
        WHILE EXISTS (SELECT * FROM queue WHERE status = 'pending')
        BEGIN
          UPDATE queue
          SET status = CASE
            WHEN priority = 1 THEN 'processing'
            ELSE 'waiting'
          END
          WHERE id = @current_id
        END
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toContain("UPDATE queue");
      expect(result[0].query).toContain("CASE");
      expect(result[0].query).toContain("END");
    });

    it("should handle DECLARE and SET statements before queries", () => {
      const sql = `
        DECLARE @count INT
        SET @count = 10
        SELECT * FROM users WHERE id < @count
        DECLARE @status VARCHAR(20)
        SET @status = 'active'
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("SELECT * FROM users WHERE id < @count");
    });

    it("should handle complex nested control flow", () => {
      const sql = `
        BEGIN TRY
          IF @mode = 'sync'
          BEGIN
            WHILE @counter < 10
            BEGIN
              SELECT * FROM batch WHERE batch_id = @counter
              IF @@ROWCOUNT > 0
                UPDATE status SET processed = 1
              ELSE
                INSERT INTO errors VALUES (@counter, 'No data')
            END
          END
          ELSE
          BEGIN
            SELECT * FROM archived_batch
          END
        END TRY
        BEGIN CATCH
          SELECT ERROR_MESSAGE()
        END CATCH
      `;
      const result = splitSqlQueries(sql);

      expect(result).toHaveLength(5);
      expect(result[0].query).toBe(
        "SELECT * FROM batch WHERE batch_id = @counter"
      );
      expect(result[1].query).toBe("UPDATE status SET processed = 1");
      expect(result[2].query).toBe(
        "INSERT INTO errors VALUES (@counter, 'No data')"
      );
      expect(result[3].query).toBe("SELECT * FROM archived_batch");
      expect(result[4].query).toBe("SELECT ERROR_MESSAGE()");
    });
  });
});
