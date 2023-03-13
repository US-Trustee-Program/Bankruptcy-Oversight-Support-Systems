package gov.doj;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public class CMHRPLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  public CMHRPLoader() {
    connectionManager = new ConnectionManager();
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
        "SET IDENTITY_INSERT dbo.CMMCD ON;INSERT INTO dbo.CMMCD"
            + " (DELETE_CODE,CASE_DIV,CASE_YEAR,CASE_NUMBER,RECORD_SEQ_NBR,REPORT_CODE,REPORT_DATE,REPORT_PERIOD,REPORT_REVIEW_CODE,ACTION_DATE,DESCRIPTION_30,USER_ID,DISP_DATE,RPHRSQ_HSEQ,SPMTDT_DATE,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,CDB_UPDATE_DATE,REPORT_DATE_DT,REPORT_PERIOD_DT,ACTION_DATE_DT,DISP_DATE_DT,SPMTDT_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,CDB_UPDATE_DATE_DT,CASE_FULL_ACMS,UPDATE_DATE,REPLICATED_DATE,id,RRN)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    Connection connection = this.connectionManager.getConnection();

    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {
      PreparedStatement statement = connection.prepareStatement(sql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {
        int index = 0;
        String[] data = lineText.split(",");
        SqlStatementHelper.setString(index, data[index++], statement);    // DELETE_CODE
        SqlStatementHelper.setInt(index, data[index++], statement);       // CASE_DIV
        SqlStatementHelper.setInt(index, data[index++], statement);       // CASE_YEAR
        SqlStatementHelper.setInt(index, data[index++], statement);       // CASE_NUMBER
        SqlStatementHelper.setInt(index, data[index++], statement);       // RECORD_SEQ_NBR
        SqlStatementHelper.setString(index, data[index++], statement);    // REPORT_CODE
        SqlStatementHelper.setInt(index, data[index++], statement);       // REPORT_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // REPORT_PERIOD
        SqlStatementHelper.setString(index, data[index++], statement);    // REPORT_REVIEW_CODE
        SqlStatementHelper.setInt(index, data[index++], statement);       // ACTION_DATE
        SqlStatementHelper.setString(index, data[index++], statement);    // DESCRIPTION_30
        SqlStatementHelper.setString(index, data[index++], statement);    // USER_ID
        SqlStatementHelper.setInt(index, data[index++], statement);       // DISP_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // RPHRSQ_HSEQ
        SqlStatementHelper.setInt(index, data[index++], statement);       // SPMTDT_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // REGION_CODE
        SqlStatementHelper.setString(index, data[index++], statement);    // GROUP_DESIGNATOR

        SqlStatementHelper.setInt(index, data[index++], statement);       // RGN_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // RGN_UPDATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // CDB_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // CDB_UPDATE_DATE

        SqlStatementHelper.setTimestamp(index, data[index++], statement); // REPORT_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // REPORT_PERIOD_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ACTION_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // DISP_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // SPMTDT_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_UPDATE_DATE_DT
        SqlStatementHelper.setString(index, data[index++], statement);    // CASE_FULL_ACMS
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // UPDATE_DATE
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // REPLICATED_DATE 
        SqlStatementHelper.setInt(index, data[index++], statement);       // id
        SqlStatementHelper.setInt(index, data[index++], statement);       // RRN

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
    try (Connection connection = getConnection()) {

      String truncateSql = "TRUNCATE TABLE dbo.CMMCD";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
