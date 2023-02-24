package gov.doj.adapters.gateways;

import gov.doj.usecases.PersistenceGateway;
import org.eclipse.microprofile.config.ConfigProvider;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

public class AzureSqlGateway implements PersistenceGateway {

    public List<String> connect() throws Exception{

        List<String> cases = new ArrayList<>();
        ResultSet resultSet = null;

        String url =  ConfigProvider.getConfig().getValue("url", String.class);
        Properties properties = new Properties();
        String user =  ConfigProvider.getConfig().getValue("sql.user", String.class);
        String password =  ConfigProvider.getConfig().getValue("password", String.class);
        properties.put("user", user);
        properties.put("password", password);

        try (Connection connection = DriverManager.getConnection(url, properties);
             Statement statement = connection.createStatement();){

            String selectSql = "SELECT case_id, case_number  from Cases";
            resultSet = statement.executeQuery(selectSql);

            // Print results from select statement
            while (resultSet.next()) {
                cases.add(resultSet.getString(1) + " " + resultSet.getString(2));
                System.out.println(resultSet.getString(1) + " " + resultSet.getString(2));
            }

            return cases;

        }
        catch (SQLException e) {

            throw new RuntimeException(e);
        }
    }
    @Override
    public List<String> getCases() {
        try {
            return connect();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
