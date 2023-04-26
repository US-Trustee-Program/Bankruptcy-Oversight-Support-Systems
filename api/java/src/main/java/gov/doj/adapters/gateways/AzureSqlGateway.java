package gov.doj.adapters.gateways;

import gov.doj.entities.Case;
import gov.doj.usecases.PersistenceGateway;
import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class AzureSqlGateway implements PersistenceGateway {

  protected ConnectionManager connectionManager;

  public AzureSqlGateway() {
    connectionManager = new ConnectionManager();
  }

  @Override
  public List<Case> getCases() {

    List<Case> casesList = new ArrayList<>();
    ResultSet resultSet = null;
    String selectSql =
        "SELECT cases_id, staff1, staff2, idi_status, idi_date, chapters_id from Cases";

    try (Connection connection = this.connectionManager.getConnection();
        Statement statement = connection.createStatement(); ) {

      resultSet = statement.executeQuery(selectSql);
      while (resultSet.next()) {
        long id = resultSet.getLong("cases_id");
        String staff1 = resultSet.getString("staff1");
        String staff2 = resultSet.getString("staff2");
        String idi_status = resultSet.getString("idi_status");
        Timestamp idi_date = resultSet.getTimestamp("idi_date");
        int chapters_id = resultSet.getInt("chapters_id");

        Case bCase = new Case(id, staff1, staff2, idi_status, idi_date, chapters_id);
        casesList.add(bCase);

        System.out.println(
            resultSet.getString(1)
                + " "
                + resultSet.getString(2)
                + " "
                + resultSet.getString(3)
                + " "
                + resultSet.getString(4)
                + " "
                + resultSet.getString(5)
                + " "
                + resultSet.getString(6)
                + " ");
      }

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    return casesList;
  }

  @Override
  public Map<String, List<String>> getCasesByProfCode(int userProfCode) {
    Map<String, List<String>> caseMap = new HashMap<>();
    ResultSet resultSet = null;
    String selectSql =
        "SELECT "
            + "debtor.CASE_DIV "
            + ", debtor.CASE_YEAR "
            + ", debtor.CASE_NUMBER "
            + ", debtor.STAFF1_PROF_CODE "
            + ", debtor.STAFF2_PROF_CODE "
            + ", professional.PROF_FIRST_NAME "
            + ", professional.UST_PROF_CODE "
            + "FROM "
            + "[dbo].[CMMDB] debtor "
            + "LEFT OUTER JOIN "
            + "[dbo].[CMMPR] professional "
            + "ON "
            + "debtor.STAFF1_PROF_CODE = professional.UST_PROF_CODE "
            + "OR "
            + "debtor.STAFF2_PROF_CODE = professional.UST_PROF_CODE "
            + "WHERE "
            + "1 = 1 "
            + "AND debtor.STAFF1_PROF_CODE = ? "
            + "OR debtor.STAFF2_PROF_CODE = ? ";

    try (Connection connection = this.connectionManager.getConnection();
        PreparedStatement statement = connection.prepareStatement(selectSql)) {

      statement.setString(1, String.valueOf(userProfCode));
      statement.setString(2, String.valueOf(userProfCode));
      resultSet = statement.executeQuery();

      while (resultSet.next()) {
        String caseNumber =
            resultSet.getInt("CASE_DIV")
                + "-"
                + resultSet.getInt("CASE_YEAR")
                + "-"
                + resultSet.getInt("CASE_NUMBER");
        int staff1 = resultSet.getInt("STAFF1_PROF_CODE");
        int staff2 = resultSet.getInt("STAFF2_PROF_CODE");
        int matchedStaff = resultSet.getInt("UST_PROF_CODE");
        String staffName = resultSet.getString("PROF_FIRST_NAME").trim();
        caseMap.put(
            caseNumber,
            Arrays.asList(
                caseNumber,
                Integer.toString(staff1),
                Integer.toString(staff2),
                Integer.toString(matchedStaff),
                staffName));
      }

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    return caseMap;
  }

  @Override
  public Optional<Case> getCase(long caseId) {
    String selectSql =
        "SELECT cases_id, staff1, staff2, idi_status, idi_date, chapters_id from Cases where"
            + " cases_id = ?";
    long cases_id = 0;
    String staff1 = "", staff2 = "", idi_status = "";
    Timestamp idi_date = Timestamp.from(Instant.now());
    int chapters_id = 0;

    try (Connection connection = this.connectionManager.getConnection();
        PreparedStatement statement = connection.prepareStatement(selectSql); ) {

      statement.setString(1, String.valueOf(caseId));
      ResultSet resultSet = statement.executeQuery();

      if (resultSet.next()) {
        cases_id = resultSet.getLong("cases_id");
        staff1 = resultSet.getString("staff1");
        staff2 = resultSet.getString("staff2");
        idi_status = resultSet.getString("idi_status");
        idi_date = resultSet.getTimestamp("idi_date");
        chapters_id = resultSet.getInt("chapters_id");
      }

      return Optional.of(new Case(cases_id, staff1, staff2, idi_status, idi_date, chapters_id));

    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public boolean createCase(Case aCaseObj) {

    String sql =
        "INSERT into Cases (staff1, staff2, idi_status, idi_date, chapters_id) VALUES (?, ?, ?, ?,"
            + " ?)";
    boolean rowInserted = false;

    try (Connection connection = this.connectionManager.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql); ) {

      statement.setString(1, aCaseObj.getStaff1());
      statement.setString(2, aCaseObj.getStaff2());
      statement.setString(3, aCaseObj.getIdi_status());
      statement.setTimestamp(4, aCaseObj.getIdi_date());
      statement.setInt(5, aCaseObj.getChapters_id());

      rowInserted = statement.executeUpdate() > 0;

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    return rowInserted;
  }

  @Override
  public boolean updateCase(Case aCaseObj) {

    String sql =
        "UPDATE Cases "
            + "SET staff1 = ?, "
            + "SET staff2 = ?, "
            + "SET idi_status = ?,"
            + "SET idi_date = ?,"
            + "SET chapters_id = ?,";
    sql += " WHERE cases_id = ?";

    boolean rowUpdated = false;
    try (Connection connection = this.connectionManager.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql); ) {

      statement.setString(1, aCaseObj.getStaff1());
      statement.setString(2, aCaseObj.getStaff2());
      statement.setString(3, aCaseObj.getIdi_status());
      statement.setTimestamp(4, aCaseObj.getIdi_date());
      statement.setInt(5, aCaseObj.getChapters_id());
      statement.setLong(6, aCaseObj.getCases_id());

      rowUpdated = statement.executeUpdate() > 0;

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    return rowUpdated;
  }

  @Override
  public boolean deleteCase(long caseId) {

    String sql = "DELETE FROM cases where cases_id = ?";
    boolean rowDeleted = false;

    try (Connection connection = this.connectionManager.getConnection();
        PreparedStatement statement = connection.prepareStatement(sql); ) {

      statement.setLong(1, caseId);

      rowDeleted = statement.executeUpdate() > 0;
    } catch (Exception e) {

    }
    return false;
  }
}
