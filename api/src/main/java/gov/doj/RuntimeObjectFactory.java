package gov.doj;

public class RuntimeObjectFactory extends ObjectFactory {
    public static void init() {
        registerObject(Presenter.class, new JsonPresenter());
    }
}
