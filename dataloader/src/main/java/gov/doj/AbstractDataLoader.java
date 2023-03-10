package gov.doj;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class AbstractDataLoader {

  private String loaderName;
  private String csvFilePath;

  public String getLoaderName() {
    return loaderName;
  }

  protected void setLoaderName(String loaderName) {
    this.loaderName = loaderName;
  }

  public String getCsvFilePath() {
    return csvFilePath;
  }

  protected void setCsvFilePath(String csvFilePath) {
    this.csvFilePath = csvFilePath;
  }

  protected Connection getConnection() throws SQLException {
    Connection connection = null;

    try {

      Properties properties = new Properties();
      properties.load(Driver.class.getClassLoader().getResourceAsStream("application.properties"));
      connection = DriverManager.getConnection(properties.getProperty("url"), properties);

    } catch (Exception e) {
      e.printStackTrace();
    }
    return connection;
  }
}
