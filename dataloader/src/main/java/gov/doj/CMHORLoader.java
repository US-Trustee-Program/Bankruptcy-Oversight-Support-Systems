package gov.doj;

import java.io.*;
import java.sql.*;
import java.text.DateFormat;
import java.text.SimpleDateFormat;

public class CMHORLoader extends AbstractDataLoader implements IDataLoader {

  private final String tableName = "dbo.CMHOR";

  public CMHORLoader() {
    setLoaderName("CMHOR");
  }

  public void initialize(String filePath) {
    setCsvFilePath(filePath);
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
          "SET IDENTITY_INSERT dbo.CMHOR ON;INSERT INTO dbo.CMHOR ("
              + " DELETE_CODE,CASE_DIV,CASE_YEAR,CASE_NUMBER,RECORD_SEQ_NBR,ORDER_CODE,COURT_DATE,CURRENT_CHAPTER,"
              + " ENTRY_DATE,USER_ID,DESCRIPTION_30,HEARING_SEQUENCE,QB_SENT_DATE,QB_POSTING_USER,QB_POSTING_WS,"
              + " PARENT_CASE_NBR,CONSOLIDATION_TYPE,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,"
              + " CDB_CREATE_DATE,CDB_UPDATE_DATE,"
              + " COURT_DATE_DT,ENTRY_DATE_DT,QB_SENT_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,CDB_UPDATE_DATE_DT,"
              + " CASE_FULL_ACMS,UPDATE_DATE,REPLICATED_DATE, id, RRN) VALUES( ?, ?, ?, ?, ?, ?, ?,"
              + " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
              + " ?)";

      Connection connection = getConnection();
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
        statement.setInt(5, Integer.parseInt(data[4])); // RECORD_SEQ_NBR
        statement.setString(6, data[5]); // ORDER_CODE
        statement.setInt(7, Integer.parseInt(data[6])); // COURT_DATE
        statement.setString(8, data[7]); // CURRENT_CHAPTER
        statement.setInt(9, Integer.parseInt(data[8])); // ENTRY_DATE
        statement.setString(10, data[9].substring(0, 10)); // USER_ID
        statement.setString(11, data[10].substring(0, 30)); // DESCRIPTION_30
        statement.setInt(12, Integer.parseInt(data[11])); // HEARING_SEQUENCE
        statement.setInt(13, Integer.parseInt(data[12])); // QB_SENT_DATE
        statement.setString(14, data[13]); // QB_POSTING_USER
        statement.setString(15, data[14]); // QB_POSTING_WS
        statement.setInt(16, Integer.parseInt(data[15])); // PARENT_CASE_NBR
        statement.setString(17, data[16]); // CONSOLIDATION_TYPE
        statement.setString(18, data[17]); // REGION_CODE
        statement.setString(19, data[18]); // GROUP_DESIGNATOR
        statement.setInt(20, Integer.parseInt(data[19])); // RGN_CREATE_DATE
        statement.setInt(21, Integer.parseInt(data[20])); // RGN_UPDATE_DATE
        statement.setInt(22, Integer.parseInt(data[21])); // CDB_CREATE_DATE
        statement.setInt(23, Integer.parseInt(data[22])); // CDB_UPDATE_DATE

        // -- DATETIME FIELDS -- //
        statement.setNull(24, Types.TIMESTAMP); // COURT_DATE_DT
        statement.setNull(25, Types.TIMESTAMP); // ENTRY_DATE_DT
        statement.setNull(26, Types.TIMESTAMP); // QB_SENT_DATE_DT
        statement.setNull(27, Types.TIMESTAMP); // RGN_CREATE_DATE_DT
        statement.setNull(28, Types.TIMESTAMP); // RGN_UPDATE_DATE_DT
        statement.setNull(29, Types.TIMESTAMP); // CDB_CREATE_DATE_DT
        statement.setNull(30, Types.TIMESTAMP); // CDB_UPDATE_DATE_DT
        statement.setString(31, data[30]); // CASE_FULL_ACMS - varchar
        statement.setNull(32, Types.TIMESTAMP); // UPDATE_DATE
        statement.setNull(33, Types.TIMESTAMP); // REPLICATED_DATE
        statement.setInt(34, Integer.parseInt(data[33])); // id
        statement.setInt(35, Integer.parseInt(data[34])); // RRN

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
    try (Connection connection = getConnection()) {

      String truncateSql = "TRUNCATE TABLE dbo.CMHOR";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }

  private boolean setIdentityInsertOn() {
    try (Connection connection = getConnection()) {

      String identitySql = "SET IDENTITY_INSERT dbo.CMHOR ON";
      Statement statement = connection.createStatement();
      return statement.execute(identitySql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
    return false;
  }

  private void setIdentityInsertOff() {
    try (Connection connection = getConnection()) {

      String identitySql = "SET IDENTITY_INSERT dbo.CMHOR OFF";
      Statement statement = connection.createStatement();
      ResultSet resultSet = statement.executeQuery(identitySql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
