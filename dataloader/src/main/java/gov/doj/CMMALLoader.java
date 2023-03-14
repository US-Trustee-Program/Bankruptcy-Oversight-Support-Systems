package gov.doj;

import java.io.*;
import java.sql.*;
import java.text.DateFormat;
import java.text.SimpleDateFormat;

public class CMMALLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final String tableName = "dbo.CMMAL";

  public CMMALLoader() {
    setLoaderName("CMMAL");
  }

  public void initialize(String filePath) {
    setCsvFilePath(filePath);
    connectionManager = ConnectionManager.getInstance();
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
    DateFormat dateFormat = new SimpleDateFormat("YYYY-MM-dd");

    // Run the data load
    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

      String sql =
          "SET IDENTITY_INSERT dbo.CMMAL ON;INSERT INTO dbo.CMMAL ("
              + " DELETE_CODE,CASE_DIV,CASE_YEAR,CASE_NUMBER,SEQ_NBR,FEDERAL_ID,BLANK_06,SOC_SEC_NUM,DEBTOR_NAME,"
              + " ENTRY_DATE,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,"
              + " CDB_UPDATE_DATE,ENTRY_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,"
              + " CDB_UPDATE_DATE_DT,CASE_FULL_ACMS,UPDATE_DATE,REPLICATED_DATE,id,RRN )  VALUES("
              + " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, )";

      Connection connection = this.connectionManager.getConnection();
      PreparedStatement statement = connection.prepareStatement(sql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {

        String[] data = lineText.split(",");
        // System.out.println("data:" + Arrays.toString(data));
        statement.setString(1, data[0]); // DELETE_CODE
        statement.setInt(2, Integer.parseInt(data[1])); // CASE_DIV
        statement.setInt(3, Integer.parseInt(data[2])); // CASE_YEAR
        statement.setInt(4, Integer.parseInt(data[3])); // CASE_NUMBER
        statement.setInt(5, Integer.parseInt(data[4])); // SEQ_NBR
        statement.setInt(6, Integer.parseInt(data[5])); // FEDERAL_ID
        statement.setString(7, data[6].substring(0, 6)); // BLANK_06
        statement.setInt(8, Integer.parseInt(data[7])); // SOC SEC NUM
        statement.setString(9, data[8]); // DEBTOR_NAME
        statement.setInt(10, Integer.parseInt(data[9])); // ENTRY_DATE
        statement.setString(11, data[10].substring(0, 2)); // REGION_CODE
        statement.setString(12, data[11].substring(0, 2)); // GROUP_DESIGNATOR
        statement.setInt(13, Integer.parseInt(data[12])); // RGN_CREATE_DATE
        statement.setInt(14, Integer.parseInt(data[13])); // RGN_UPDATE_DATE
        statement.setInt(15, Integer.parseInt(data[14])); // CDB_CREATE_DATE
        statement.setInt(16, Integer.parseInt(data[15])); // CDB_UPDATE_DATE

        // -- DATETIME FIELDS -- //
        statement.setNull(17, Types.TIMESTAMP); // ENTRY_DATE_DT
        statement.setNull(18, Types.TIMESTAMP); // RGN_CREATE_DATE_DT
        statement.setNull(19, Types.TIMESTAMP); // RGN_UPDATE_DATE_DT
        statement.setNull(20, Types.TIMESTAMP); // CDB_CREATE_DATE_DT
        statement.setNull(21, Types.TIMESTAMP); // CDB_UPDATE_DATE_DT
        statement.setString(22, data[21]); // CASE_FULL_ACMS - varchar
        statement.setNull(23, Types.TIMESTAMP); // UPDATE_DATE
        statement.setNull(24, Types.TIMESTAMP); // REPLICATED_DATE

        statement.setInt(25, Integer.parseInt(data[24])); // id
        statement.setInt(26, Integer.parseInt(data[25])); // RRN

        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
        System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count);
      }

    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    } catch (IOException e) {
      throw new RuntimeException(e);
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void clearTable() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.CMMAL";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }

  private boolean setIdentityInsertOn() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String identitySql = "SET IDENTITY_INSERT dbo.CMMAL ON";
      Statement statement = connection.createStatement();
      return statement.execute(identitySql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
    return false;
  }

  private void setIdentityInsertOff() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String identitySql = "SET IDENTITY_INSERT dbo.CMMAL OFF";
      Statement statement = connection.createStatement();
      ResultSet resultSet = statement.executeQuery(identitySql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
