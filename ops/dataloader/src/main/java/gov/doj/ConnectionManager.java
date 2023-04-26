package gov.doj;

import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class ConnectionManager {
  private static ConnectionManager connectionManager;
  private final Properties properties;
  private Connection connection;

  private ConnectionManager() {
    properties = new Properties();
    try {
      properties.load(getClass().getClassLoader().getResourceAsStream("application.properties"));
      properties.load(Driver.class.getClassLoader().getResourceAsStream(".env"));
    } catch (IOException e) {
      throw new RuntimeException(e);
    } catch (Exception e) {
      e.printStackTrace();
      throw new RuntimeException(e);
    }
  }

  public static ConnectionManager getInstance() {
    if (connectionManager == null) {
      connectionManager = new ConnectionManager();
    }
    return connectionManager;
  }

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
}
