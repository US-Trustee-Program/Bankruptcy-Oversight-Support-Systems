package gov.doj.adapters.gateways;

import gov.doj.entities.Case;
import gov.doj.usecases.PersistenceGateway;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class AzureSqlGateway implements PersistenceGateway {

    protected  ConnectionManager connectionManager;

    public AzureSqlGateway(){
        connectionManager = new ConnectionManager();
    }

    @Override
    public List<String> getCases() {

        List<String> cases = new ArrayList<>();
        ResultSet resultSet = null;
        String selectSql = "SELECT *  from Cases";

        try (Connection connection = this.connectionManager.getConnection();
              Statement statement = connection.createStatement(); ){

            resultSet = statement.executeQuery(selectSql);
            while (resultSet.next()) {
                cases.add(resultSet.getString(1) + " "
                        + resultSet.getString(2) + " "
                        + resultSet.getString(3) + " "
                        + resultSet.getString(4) + " "
                        + resultSet.getString(5) + " "
                        + resultSet.getString(6) + " "
                );
                System.out.println(resultSet.getString(1) + " "
                        + resultSet.getString(2) + " "
                        + resultSet.getString(3) + " "
                        + resultSet.getString(4) + " "
                        + resultSet.getString(5) + " "
                        + resultSet.getString(6) + " "

                );
            }

        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        return cases;
    }

    @Override
    public List<String> getCase(long caseId) {
        return null;
    }

    @Override
    public long createCase(Case aCaseObj) {
        return 0;
    }

    @Override
    public void updateCase(Case aCaseObj) {

    }

    @Override
    public void deleteCase(long casesId) {

    }
}
