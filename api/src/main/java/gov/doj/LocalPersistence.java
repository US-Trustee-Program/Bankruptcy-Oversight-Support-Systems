package gov.doj;

import java.util.ArrayList;
import java.util.List;

public class LocalPersistence implements PersistenceGateway {
    List<String> caseList = new ArrayList<>();

    @Override
    public void addCase(String caseData) {
        caseList.add(caseData);
    }
}
