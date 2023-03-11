package gov.doj;

import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class ConnectionManager {

  private final Properties properties;
  private Connection connection;

  public ConnectionManager() {
    properties = new Properties();
    try {
      properties.load(Driver.class.getClassLoader().getResourceAsStream("application.properties"));
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  public Connection getConnection() {

    try {
      connection = DriverManager.getConnection(properties.getProperty("url"), properties);
    } catch (SQLException e) {
      e.printStackTrace();
    }

    return connection;
  }
}
