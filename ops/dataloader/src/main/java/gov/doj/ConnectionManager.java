package gov.doj;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class ConnectionManager {
  private static ConnectionManager connectionManager;
  private Properties properties;
  private Connection connection;

  private ConnectionManager() {
    this.loadProperties();
  }

  public static synchronized ConnectionManager getInstance() {
    if (connectionManager == null) {
      connectionManager = new ConnectionManager();
    }
    return connectionManager;
  }

  @Deprecated() // Use getACMSREPConnection or getAODATEXConnection instead to get connection to
  // specific databases. Remember to invoke .close() on connection after use.
  public Connection getConnection() {
    try {
      connection =
          DriverManager.getConnection(
              properties.getProperty("url"),
              properties.getProperty("user"),
              properties.getProperty("password"));
    } catch (SQLException e) {
      e.printStackTrace();
    }
    return connection;
  }

  public Connection getACMSREPConnection() {
    try {
      return DriverManager.getConnection(
          properties.getProperty("acms_rep_connection_string"),
          properties.getProperty("acms_rep_user"),
          properties.getProperty("acms_rep_password"));
    } catch (SQLException e) {
      e.printStackTrace();
      return null;
    }
  }

  public Connection getAODATEXConnection() {
    try {
      return DriverManager.getConnection(
          properties.getProperty("aodatex_connection_string"),
          properties.getProperty("aodatex_user"),
          properties.getProperty("aodatex_password"));
    } catch (SQLException e) {
      e.printStackTrace();
      return null;
    }
  }

  private void loadProperties() {
    if (this.properties == null) {
      try {
        this.properties = new Properties();
        properties.load(getClass().getClassLoader().getResourceAsStream("application.properties"));
        properties.load(Driver.class.getClassLoader().getResourceAsStream(".env"));
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
  }
}
