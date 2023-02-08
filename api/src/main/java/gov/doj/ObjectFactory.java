package gov.doj;

import java.util.HashMap;
import java.util.Map;

public abstract class ObjectFactory {
    private static final Map<String, Object> objectMap = new HashMap<>();

    protected ObjectFactory() {}

    public static <T> T getObjectByAbstractClass(final Class<T> clazz) {
        @SuppressWarnings("unchecked")
        final T object = (T) objectMap.get(clazz.getName());

        if (object == null) {
            throw new IllegalArgumentException("Couldn't find object for " + clazz.getName());
        }

        return object;
    }

    public static void registerObject(final Class<?> clazz, final Object reference) {
        objectMap.put(clazz.getName(), reference);
    }
}
