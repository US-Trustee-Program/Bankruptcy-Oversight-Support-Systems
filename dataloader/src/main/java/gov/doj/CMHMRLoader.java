package gov.doj;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.*;

public class CMHMRLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final String tableName = "dbo.CMHMR";

  public CMHMRLoader() {
    setLoaderName("CMHMR");
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
          "SET IDENTITY_INSERT dbo.CMHMR ON;INSERT INTO dbo.CMHMR"
              + "([DELETE_CODE],[CASE_DIV],[CASE_YEAR],[CASE_NUMBER],[RECORD_SEQ_NBR],[REPORT_DATE],[PERIOD_DATE],[DISBURSEMENT_PERIOD],[DISBURSEMENT_TYPE],[DISBURSEMENT_AMT]"
              + ",[DESCRIPTION_30],[ENTRY_DATE],[USER_ID],[MRWSID],[QB_SENT_DATE],[QB_SEND_USER],[QB_SEND_WS_ID],[REGION_CODE],[GROUP_DESIGNATOR],[RGN_CREATE_DATE],[RGN_UPDATE_DATE]"
              + ",[CDB_CREATE_DATE],[CDB_UPDATE_DATE],[REPORT_DATE_DT],[PERIOD_DATE_DT],[ENTRY_DATE_DT],[QB_SENT_DATE_DT],[RGN_CREATE_DATE_DT],[RGN_UPDATE_DATE_DT],[CDB_CREATE_DATE_DT]"
              + ",[CDB_UPDATE_DATE_DT],[CASE_FULL_ACMS],[UPDATE_DATE],[REPLICATED_DATE],[id],[RRN])"
              + " VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
              + " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

      Connection connection = this.connectionManager.getConnection();
      PreparedStatement statement = connection.prepareStatement(insertSql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {

        String[] data = lineText.split(",");

        // System.out.println("data:" + Arrays.toString(data));

        setValuesToInsert(statement, data);

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

  private void setValuesToInsert(PreparedStatement statement, String[] data)
      throws SQLException {
    statement.setString(1, data[0]); // [DELETE_CODE]
    statement.setInt(2, Integer.parseInt(data[1])); // CASE_DIV
    statement.setInt(3, Integer.parseInt(data[2])); // CASE_YEAR
    statement.setInt(4, Integer.parseInt(data[3])); // CASE_NUMBER
    statement.setInt(5, Integer.parseInt(data[4])); // RECORD_SEQ_NBR
    statement.setInt(6, Integer.parseInt(data[5])); // REPORT_DATE
    statement.setInt(7, Integer.parseInt(data[6])); // PERIOD_DATE
    statement.setString(8, data[7]); // DISBURSEMENT_PERIOD
    statement.setString(9, data[8]); // DISBURSEMENT_TYPE
    statement.setInt(10, Integer.parseInt(data[9])); // DISBURSEMENT_AMT
    statement.setString(11, data[10].substring(0, 29)); // DESCRIPTION_30
    statement.setInt(12, Integer.parseInt(data[11])); // ENTRY_DATE
    statement.setString(13, data[12].substring(0, 9)); // USER_ID
    statement.setString(14, data[13]); // MRWSID
    statement.setInt(15, Integer.parseInt(data[14])); // QB_SENT_DATE
    statement.setString(16, data[15].substring(0, 9)); // QB_SEND_USER
    statement.setString(17, data[16]); // QB_SEND_WS_ID
    statement.setString(18, data[17]); // REGION_CODE
    statement.setString(19, data[18]); // GROUP_DESIGNATOR
    statement.setInt(20, Integer.parseInt(data[19])); // RGN_CREATE_DATE
    statement.setInt(21, Integer.parseInt(data[20])); // RGN_UPDATE_DATE
    statement.setInt(22, Integer.parseInt(data[21])); // CDB_CREATE_DATE
    statement.setInt(23, Integer.parseInt(data[22])); // CDB_UPDATE_DATE



    if (data[23] == null || data[23] == "NULL" || data[23].isEmpty() || data[23].contains("NULL")) {
      statement.setNull(24, Types.TIMESTAMP); // REPORT_DATE_DT
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(24, Types.TIMESTAMP);
    }

    if (data[24] == null || data[24] == "NULL" || data[24].isEmpty() || data[24].contains("NULL")) {
      statement.setNull(25, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(25, Types.TIMESTAMP); // PERIOD_DATE_DT
    }

    if (data[25] == null || data[25] == "NULL" || data[25].isEmpty() || data[25].contains("NULL")) {
      statement.setNull(26, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(26, Types.TIMESTAMP); // ENTRY_DATE_DT
    }

    if (data[26] == null || data[26] == "NULL" || data[26].isEmpty() || data[26].contains("NULL")) {
      statement.setNull(27, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(27, Types.TIMESTAMP); // QB_SENT_DATE_DT
    }

    if (data[27] == null || data[27] == "NULL" || data[27].isEmpty() || data[27].contains("NULL")) {
      statement.setNull(28, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(28, Types.TIMESTAMP); // RGN_CREATE_DATE_DT
    }

    if (data[28] == null || data[28] == "NULL" || data[28].isEmpty() || data[28].contains("NULL")) {
      statement.setNull(29, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(29, Types.TIMESTAMP); // RGN_UPDATE_DATE_DT
    }

    if (data[29] == null || data[29] == "NULL" || data[29].isEmpty() || data[29].contains("NULL")) {
      statement.setNull(30, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(30, Types.TIMESTAMP); // CDB_CREATE_DATE_DT
    }

    if (data[30] == null || data[30] == "NULL" || data[30].isEmpty() || data[30].contains("NULL")) {
      statement.setNull(31, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(31, Types.TIMESTAMP); // CDB_UPDATE_DATE_DT
    }

    statement.setString(32, data[31]); // CASE_FULL_ACMS

    if (data[32] == null || data[32] == "NULL" || data[32].isEmpty() || data[32].contains("NULL")) {
      statement.setNull(33, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(33, Types.TIMESTAMP); // UPDATE_DATE
    }

    if (data[33] == null || data[33] == "NULL" || data[33].isEmpty() || data[33].contains("NULL")) {
      statement.setNull(34, Types.TIMESTAMP);
    } else {
      // statement.setTimestamp(30, Timestamp.valueOf(data[29]));
      statement.setNull(34, Types.TIMESTAMP); // REPLICATED_DATE
    }

    statement.setInt(35, Integer.parseInt(data[34])); // id
    statement.setInt(36, Integer.parseInt(data[35])); // RRN
  }

  private void setTimeStamp(int dataIndex, String data, PreparedStatement statement) {

    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {

        statement.setNull(dataIndex + 1, Types.TIMESTAMP);
      } else {
        // statement.setTimestamp(dataIndex+1, Timestamp.valueOf(data)); //Nullify timestamp columns - story#111
        statement.setNull(dataIndex+1, Types.TIMESTAMP);
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }
  @Override
  public void clearTable() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.CMHMR";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
