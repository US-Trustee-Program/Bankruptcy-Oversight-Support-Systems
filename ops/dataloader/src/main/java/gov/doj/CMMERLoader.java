package gov.doj;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.*;
import java.util.Arrays;

public class CMMERLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final String tableName = "dbo.CMMER";

  public CMMERLoader() {
    setLoaderName("CMMER");
    connectionManager = ConnectionManager.getInstance();
  }

  @Override
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

    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

      String insertSql =
          "SET IDENTITY_INSERT dbo.CMMER ON;INSERT INTO dbo.CMMER("
              + " [DELETE_CODE],[EVENT_TYPE],[EVENT_CODE],[REVIEW_CODE],[REVIEW_CODE_DESC]"
              + ",[USER_ID],[ENTRY_DATE],[REGION_CODE],[GROUP_DESIGNATOR]"
              + ",[RGN_CREATE_DATE],[RGN_UPDATE_DATE],[CDB_CREATE_DATE],[CDB_UPDATE_DATE],[ENTRY_DATE_DT]"
              + ",[RGN_CREATE_DATE_DT],[RGN_UPDATE_DATE_DT],[CDB_CREATE_DATE_DT],[CDB_UPDATE_DATE_DT],[UPDATE_DATE],[REPLICATED_DATE],[id],[RRN]"
              + " )VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)";

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

    statement.setString(1, data[0]); // [DELETE_CODE]
    statement.setString(2, data[1]); // [EVENT_TYPE]
    statement.setString(3, data[2]); // [EVENT_CODE]
    statement.setString(4, data[3]); // [REVIEW_CODE]
    statement.setString(5, data[4]); // [REVIEW_CODE_DESC]
    statement.setString(6, data[5]); // [USER_ID]
    statement.setInt(7, Integer.parseInt(data[6])); // [ENTRY_DATE]
    statement.setString(8, data[7]); // [REGION_CODE]
    statement.setString(9, data[8]); // [GROUP_DESIGNATOR]
    statement.setInt(10, Integer.parseInt(data[9])); // RGN_CREATE_DATE
    statement.setInt(11, Integer.parseInt(data[10])); // RGN_UPDATE_DATE
    statement.setInt(12, Integer.parseInt(data[11])); // CDB_CREATE_DATE
    statement.setInt(13, Integer.parseInt(data[12])); // CDB_UPDATE_DATE
    setTimeStamp(14, data[13], statement); // ENTRY_DATE_DT
    setTimeStamp(15, data[14], statement); // RGN_CREATE_DATE_DT
    setTimeStamp(16, data[15], statement); // RGN_UPDATE_DATE_DT
    setTimeStamp(17, data[16], statement); // CDB_CREATE_DATE_DT
    setTimeStamp(18, data[17], statement); // CDB_UPDATE_DATE_DT
    setTimeStamp(19, data[18], statement); // UPDATE_DATE
    setTimeStamp(20, data[19], statement); // REPLICATED_DATE
    statement.setInt(21, Integer.parseInt(data[20])); // id
    statement.setInt(22, Integer.parseInt(data[21])); // RRN
  }

  private void setTimeStamp(int dataIndex, String data, PreparedStatement statement) {
    try {
      if (data == null || data.isEmpty() || data.contains("NULL")) {

        statement.setNull(dataIndex + 1, Types.TIMESTAMP);
      } else {
        // statement.setTimestamp(dataIndex+1, Timestamp.valueOf(data));
        statement.setNull(dataIndex + 1, Types.TIMESTAMP); // Nullify timestamp columns - story#111
      }
    } catch (SQLException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void clearTable() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.CMMER";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
