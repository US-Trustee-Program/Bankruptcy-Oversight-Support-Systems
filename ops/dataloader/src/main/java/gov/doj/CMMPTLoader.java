package gov.doj;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;

public class CMMPTLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final String tableName = "dbo.CMMPT";

  public CMMPTLoader() {
    setLoaderName("CMMPT");
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
  public void loadTable() {
    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

      String insertSql =
          "SET IDENTITY_INSERT dbo.CMMPT ON;INSERT INTO dbo.CMMPT([DELETE_CODE],"
              + " [PROF_TYPE],[PROF_TYPE_DESC],[USER_ID],[ENTRY_DATE],[KEY_DEBTOR_YN]"
              + " ,[MULTI_OCCUR],[REGION_CODE],[GROUP_DESIGNATOR],[RGN_CREATE_DATE],[RGN_UPDATE_DATE],[CDB_CREATE_DATE],[CDB_UPDATE_DATE],[id],[RRN])"
              + "  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

      Connection connection = this.connectionManager.getConnection();
      PreparedStatement statement = connection.prepareStatement(insertSql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line
      while ((lineText = lineReader.readLine()) != null) {

        String[] data = lineText.split(",");
        System.out.println("data:" + Arrays.toString(data));
        setValuesToInsert(statement, data);
        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
        System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count);
      }
    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    } catch (IOException | SQLException e) {
      throw new RuntimeException(e);
    }
  }

  private void setValuesToInsert(PreparedStatement statement, String[] data) throws SQLException {

    statement.setString(1, ""); // [DELETE_CODE];
    statement.setString(2, data[0].trim()); // PROF_TYPE
    statement.setString(3, data[1].replace("\"", "").trim()); // PROF_TYPE_DESC
    statement.setString(4, ""); // USER_ID
    statement.setInt(5, 0); // ENTRY_DATE
    statement.setString(6, ""); // KEY_DEBTOR_YN
    statement.setString(7, ""); // MULTI_OCCUR
    statement.setString(8, data[2].trim()); // REGION_CODE
    statement.setString(9, data[3].trim()); // GROUP_DESIGNATOR
    statement.setInt(10, 0); // RGN_CREATE_DATE
    statement.setInt(11, 0); // RGN_UPDATE_DATE
    statement.setInt(12, 0); // CDB_CREATE_DATE
    statement.setInt(13, 0); // CDB_UPDATE_DATE
    statement.setInt(14, 0); // id
    statement.setInt(15, 0); // RRN
  }

  @Override
  public void clearTable() {

    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.CMMPT";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
