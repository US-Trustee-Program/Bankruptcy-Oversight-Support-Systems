package gov.doj;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public class CMHORLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  public CMHORLoader() {
    setLoaderName("CMHOR");
    connectionManager = ConnectionManager.getInstance();
  }

  @Override
  public void run() {
    // clear the table
    clearTable();

    // Load up the data
    loadTable();
  }

  @Override
  public void initialize(String filePath) {
    setCsvFilePath(filePath);
  }

  @Override
  public void loadTable() {
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

    Connection connection = this.connectionManager.getConnection();

    // Run the data load
    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {
      PreparedStatement statement = connection.prepareStatement(sql);

      String lineText = null;
      int count = 0;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {
        int index = 0;

        String[] data = lineText.split(",");
        SqlStatementHelper.setCharString(index, data[index++], 1, statement); // DELETE_CODE
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_DIV
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_YEAR
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_NUMBER
        SqlStatementHelper.setInt(index, data[index++], statement); // RECORD_SEQ_NBR
        SqlStatementHelper.setCharString(index, data[index++], 3, statement); // ORDER_CODE
        SqlStatementHelper.setLong(index, data[index++], statement); // COURT_DATE
        SqlStatementHelper.setCharString(index, data[index++], 2, statement); // CURRENT_CHAPTER
        SqlStatementHelper.setLong(index, data[index++], statement); // ENTRY_DATE
        SqlStatementHelper.setCharString(index, data[index++], 10, statement); // USER_ID
        SqlStatementHelper.setCharString(index, data[index++], 30, statement); // DESCRIPTION_30
        SqlStatementHelper.setInt(index, data[index++], statement); // HEARING_SEQUENCE
        SqlStatementHelper.setLong(index, data[index++], statement); // QB_SENT_DATE
        SqlStatementHelper.setCharString(index, data[index++], 10, statement); // QB_POSTING_USER
        SqlStatementHelper.setCharString(index, data[index++], 2, statement); // QB_POSTING_WS
        SqlStatementHelper.setLong(index, data[index++], statement); // PARENT_CASE_NBR
        SqlStatementHelper.setCharString(index, data[index++], 1, statement); // CONSOLIDATION_TYPE
        SqlStatementHelper.setCharString(index, data[index++], 2, statement); // REGION_CODE
        SqlStatementHelper.setCharString(index, data[index++], 2, statement); // GROUP_DESIGNATOR
        SqlStatementHelper.setInt(index, data[index++], statement); // RGN_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // RGN_UPDATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // CDB_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // CDB_UPDATE_DATE
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // COURT_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ENTRY_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // QB_SENT_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_UPDATE_DATE_DT
        SqlStatementHelper.setVarCharString(
            index, data[index++], 10, statement); // CASE_FULL_ACMS - varchar
        SqlStatementHelper.setTimestamp(
            index++, "NULL",
            statement); // UPDATE_DATE (using NULL rather than actual string because data in input
                        // file is messed up and will cause an exception)
        SqlStatementHelper.setTimestamp(index++, "NULL", statement); // REPLICATED_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // id
        SqlStatementHelper.setInt(index, data[index++], statement); // RRN

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

      String truncateSql = "TRUNCATE TABLE dbo.CMHOR";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
