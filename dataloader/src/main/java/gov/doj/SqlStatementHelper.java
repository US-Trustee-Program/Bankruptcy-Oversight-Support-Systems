package gov.doj;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;

public class SqlStatementHelper {
  public static void setCharString(int index, String data, PreparedStatement statement) {
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

  public static void setVarCharString(int index, String data, PreparedStatement statement) {
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

  public static void setInt(int index, String data, PreparedStatement statement) {
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

  public static String maxChars(String data, int maxLength) {
    if (data.length() <= maxLength) {
      return data;
    } else {
      return data.substring(0, maxLength - 1);
    }
  }
}
