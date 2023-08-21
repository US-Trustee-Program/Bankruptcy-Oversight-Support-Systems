package gov.doj.dxtr;

import gov.doj.AbstractDataLoader;
import gov.doj.ConnectionManager;
import gov.doj.IDataLoader;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

public class AoCsDataLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final String tableName = "dbo.AO_CS";

  public AoCsDataLoader() {
    setLoaderName("AO_CS_Data_Loader");
    connectionManager = ConnectionManager.getInstance();
  }

  @Override
  public void initialize(String csvFilePath) {
    setCsvFilePath(csvFilePath);
  }

  @Override
  public void run() {
    // clear the table
    clearTable();

    // Load up the data
    loadTable();

    // Cleanup
  }

  @Override
  public void loadTable() {}

  @Override
  public void clearTable() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.AO_CS";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
