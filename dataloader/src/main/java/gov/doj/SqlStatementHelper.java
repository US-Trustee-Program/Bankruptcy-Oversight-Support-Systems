package gov.doj;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;

public class SqlStatementHelper {
  /**
   * setCharString - Formats a fixed character string and properly handles NULL
   *
   * @param index - used to determine which SQL template placeholder to fill
   * @param data - value to set data field to
   * @param statement - SQL statement to update
   */
  public static void setCharString(int index, String data, PreparedStatement statement) {
    // added for debugging.  Uncomment if needed.
    // System.out.println("Char String " + data + " : " + index);
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {
        statement.setNull(index + 1, Types.CHAR);
      } else {
        statement.setString(index + 1, data);
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  /**
   * setCharString - Formats a fixed length character string and properly handles NULL. Forces max
   * length.
   *
   * @param index - used to determine which SQL template placeholder to fill
   * @param data - value to set data field to
   * @param length - length expected by database. Data will be tuncated to this length if too long.
   * @param statement - SQL statement to update
   */
  public static void setCharString(
      int index, String data, int length, PreparedStatement statement) {
    String finalData = data;

    if (length > 0 && length < data.length()) {
      finalData = data.trim().substring(0, length);
    }

    setCharString(index, finalData, statement);
  }

  public static void setVarCharString(int index, String data, PreparedStatement statement) {
    // added for debugging.  Uncomment if needed.
    // System.out.println("Variable Length Char String " + data + " : " + index);
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {
        statement.setNull(index + 1, Types.VARCHAR);
      } else {
        statement.setString(index + 1, data);
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  public static void setVarCharString(
      int index, String data, int length, PreparedStatement statement) {
    String finalData = data;

    if (length > 0 && length < data.length()) {
      finalData = data.trim().substring(0, length);
    }

    setVarCharString(index, finalData, statement);
  }

  public static void setInt(int index, String data, PreparedStatement statement) {
    // added for debugging.  Uncomment if needed.
    // System.out.println("Int " + data + " : " + index);
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {
        statement.setNull(index + 1, Types.INTEGER);
      } else {
        statement.setInt(index + 1, Integer.parseInt(data));
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  public static void setLong(int index, String data, PreparedStatement statement) {
    // added for debugging.  Uncomment if needed.
    // System.out.println("Long " + data + " : " + index);
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {
        statement.setNull(index + 1, Types.INTEGER);
      } else {
        statement.setLong(index + 1, Long.parseLong(data));
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  public static void setDouble(int index, String data, PreparedStatement statement) {
    // added for debugging.  Uncomment if needed.
    // System.out.println("Double " + data + " : " + index);
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {
        statement.setNull(index + 1, Types.DOUBLE);
      } else {
        statement.setDouble(index + 1, Double.parseDouble(data));
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  public static void setTimestamp(int index, String data, PreparedStatement statement) {
    // added for debugging.  Uncomment if needed.
    // System.out.println("timestamp data " + data + " : " + index);
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {
        statement.setNull(index + 1, Types.TIMESTAMP);
      } else {
        statement.setTimestamp(index + 1, Timestamp.valueOf(data));
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  /**
   * maxChars - Truncates data without trimming.
   *
   * @param data - string to truncate
   * @param maxLength - max length of string. If string is shorter, just return string.
   * @return - truncated string
   */
  public static String maxChars(String data, int maxLength) {
    if (data.length() <= maxLength) {
      return data;
    } else {
      return data.substring(0, maxLength - 1);
    }
  }
}
