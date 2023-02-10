package gov.doj;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CaseListUseCase {

    public void getCases(String user) {
        List<String> caseOne = Arrays.asList("Chapter 11", "Debby Debtor", "Brian BusinessAnalyst");
        Map<String, List<String>> cases = new HashMap<>();
        cases.put("477-14-12211", caseOne);
        Presenter presenter = ObjectFactory.getObjectByAbstractClass(Presenter.class);
        presenter.onSuccess(cases.toString());
    }

    public void addCase(String caseData) {
        PersistenceGateway dbGateway = ObjectFactory.getObjectByAbstractClass(PersistenceGateway.class);
        dbGateway.addCase(caseData);
    }
}
