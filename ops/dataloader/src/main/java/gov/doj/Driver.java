package gov.doj;

import com.microsoft.sqlserver.jdbc.SQLServerDriver;

import java.io.IOException;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class Driver {

  private static LoaderMap loaderMap = new LoaderMap();

  public static void main(String[] args) {
    try {
      DriverManager.registerDriver(new SQLServerDriver());
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }

    try {
      Properties csvProperties = new Properties();
      csvProperties.load(Driver.class.getClassLoader().getResourceAsStream("csvfiles.properties"));

      if (!csvProperties.isEmpty()) {
        csvProperties.forEach(
            (k, v) -> {
              System.out.println("CSV Loader : " + k + " CSV File Path : " + v);

              String loaderKey = k.toString().toLowerCase();
              String loaderFilePath = v.toString().toLowerCase();

              IDataLoader dataLoader = (IDataLoader) loaderMap.map.get(loaderKey);

              if (dataLoader == null) {

                System.out.println("No Data loader process found for : " + loaderKey);

              } else {

                System.out.println("Initializing the loader with the file : " + loaderFilePath);
                dataLoader.initialize(loaderFilePath);

                System.out.println("Starting the load run...");
                dataLoader.run();

                System.out.println("Load Complete.");
              }
            });
      }

    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }
}
