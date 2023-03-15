package gov.doj;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public class CMHPLLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  public CMHPLLoader() {
    connectionManager = ConnectionManager.getInstance();
  }

  @Override
  public void run() {
    clearTable();
     loadTable();
  }

  @Override
  public void initialize(String filePath) {
    setCsvFilePath(filePath);
  }

  @Override
  public void loadTable() {
    String sql =
        "SET IDENTITY_INSERT dbo.CMHPL ON;INSERT INTO dbo.CMHPL"
            + " (DELETE_CODE,CASE_DIV,CASE_YEAR,CASE_NUMBER,RECORD_SEQ_NBR,PLEADING_CODE,PLEADOR_TYPE,PLEADORS_NAME,PLEADING_DATE,ACTION_DATE,PLEADING_DISP,DISPOSITION_DATE,ENTRY_DATE,DESCRIPTION_30,PLEADING_SORT_DATE,HEARING_SEQUENCE,COURT_DISPOSITION,COURT_DISPOSITION_DATE,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,CDB_UPDATE_DATE,PLEADING_DATE_DT,ACTION_DATE_DT,DISPOSITION_DATE_DT,ENTRY_DATE_DT,PLEADING_SORT_DATE_DT,COURT_DISPOSITION_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,CDB_UPDATE_DATE_DT,CASE_FULL_ACMS,UPDATE_DATE,REPLICATED_DATE,id,RRN)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    Connection connection = this.connectionManager.getConnection();

    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {
      PreparedStatement statement = connection.prepareStatement(sql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {
        int index = 0;
        String[] data = lineText.split(",");
        SqlStatementHelper.setCharString(index, data[index++], statement); // DELETE_CODE
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_DIV
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_YEAR
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_NUMBER
        SqlStatementHelper.setInt(index, data[index++], statement); // RECORD_SEQ_NBR
        SqlStatementHelper.setCharString(index, data[index++], statement); // PLEADING_CODE
        SqlStatementHelper.setCharString(index, data[index++], statement); // PLEADOR_TYPE
        SqlStatementHelper.setCharString(index, data[index++], statement); // PLEADORS_NAME
        SqlStatementHelper.setInt(index, data[index++], statement); // PLEADING_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // ACTION_DATE
        SqlStatementHelper.setCharString(index, data[index++], statement); // PLEADING_DISP
        SqlStatementHelper.setInt(index, data[index++], statement); // DISPOSITION_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // ENTRY_DATE
        SqlStatementHelper.setCharString(
            index, data[index++].substring(0, 30), statement); // DESCRIPTION_30
        SqlStatementHelper.setInt(index, data[index++], statement); // PLEADING_SORT_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // HEARING_SEQUENCE
        SqlStatementHelper.setCharString(index, data[index++], statement); // COURT_DISPOSITION
        SqlStatementHelper.setInt(index, data[index++], statement); // COURT_DISPOSITION_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // REGION_CODE
        SqlStatementHelper.setCharString(index, data[index++], statement); // GROUP_DESIGNATOR

        SqlStatementHelper.setInt(index, data[index++], statement); // RGN_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // RGN_UPDATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // CDB_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // CDB_UPDATE_DATE

        SqlStatementHelper.setTimestamp(index, data[index++], statement); // PLEADING_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ACTION_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // DISPOSITION_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ENTRY_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // PLEADING_SORT_DATE_DT
        SqlStatementHelper.setTimestamp(
            index, data[index++], statement); // COURT_DISPOSITION_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CASE_FULL_ACMS
        SqlStatementHelper.setTimestamp(index++, "NULL", statement); // UPDATE_DATE Story #111 ; using NULL since data is messed up in the input csv for this column.
        SqlStatementHelper.setTimestamp(index++, "NULL", statement); // REPLICATED_DATE Story #111, set timestamp columns to null.
        SqlStatementHelper.setInt(index, data[index++], statement); // id
        SqlStatementHelper.setInt(index, data[index++], statement); // RRN

        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
        System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count);
      }
    } catch (IOException | SQLException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void clearTable() {
    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.CMHPL";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
