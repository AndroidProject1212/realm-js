////////////////////////////////////////////////////////////////////////////
//
// Copyright 2016 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////

#pragma once

#include "js_collection.hpp"
#include "js_realm_object.hpp"

#include "results.hpp"
#include "list.hpp"
#include "object_store.hpp"
#include "parser.hpp"
#include "query_builder.hpp"

namespace realm {
namespace js {

template<typename T>
struct ResultsClass : ClassDefinition<T, ObservableCollection<T, Results>, CollectionClass<T>> {
    using ContextType = typename T::Context;
    using ObjectType = typename T::Object;
    using ValueType = typename T::Value;
    using FunctionType = typename T::Function;
    using Object = js::Object<T>;
    using Value = js::Value<T>;
    using ReturnValue = js::ReturnValue<T>;
    using Collection = ObservableCollection<T, Results>;

    static ObjectType create_instance(ContextType, realm::Results);
    static ObjectType create_instance(ContextType, SharedRealm, const ObjectSchema &);

    template<typename U>
    static ObjectType create_filtered(ContextType, const U &, size_t, const ValueType[]);

    template<typename U>
    static ObjectType create_sorted(ContextType, const U &, size_t, const ValueType[]);

    static void get_length(ContextType, ObjectType, ReturnValue &);
    static void get_index(ContextType, ObjectType, uint32_t, ReturnValue &);

    static void snapshot(ContextType, ObjectType, size_t, const ValueType[], ReturnValue &);
    static void filtered(ContextType, ObjectType, size_t, const ValueType[], ReturnValue &);
    static void sorted(ContextType, ObjectType, size_t, const ValueType[], ReturnValue &);
    static void is_valid(ContextType, ObjectType, size_t, const ValueType [], ReturnValue &);

    // observable
    static void add_listener(ContextType, ObjectType, size_t, const ValueType[], ReturnValue &);
    static void remove_listener(ContextType, ObjectType, size_t, const ValueType[], ReturnValue &);
    static void remove_all_listeners(ContextType, ObjectType, size_t, const ValueType[], ReturnValue &);

    std::string const name = "Results";

    MethodMap<T> const methods = {
        {"snapshot", wrap<snapshot>},
        {"filtered", wrap<filtered>},
        {"sorted", wrap<sorted>},
        {"isValid", wrap<is_valid>},
        {"addListener", wrap<add_listener>},
        {"removeListener", wrap<remove_listener>},
        {"removeAllListeners", wrap<remove_all_listeners>},
    };

    PropertyMap<T> const properties = {
        {"length", {wrap<get_length>, nullptr}},
    };

    IndexPropertyType<T> const index_accessor = {wrap<get_index>, nullptr};
};

template<typename T>
typename T::Object ResultsClass<T>::create_instance(ContextType ctx, realm::Results results) {
    return create_object<T, ResultsClass<T>>(ctx, new Collection(std::move(results)));
}

template<typename T>
typename T::Object ResultsClass<T>::create_instance(ContextType ctx, SharedRealm realm, const ObjectSchema &object_schema) {
    auto table = ObjectStore::table_for_object_type(realm->read_group(), object_schema.name);
    return create_object<T, ResultsClass<T>>(ctx, new Collection(realm, *table));
}

template<typename T>
template<typename U>
typename T::Object ResultsClass<T>::create_filtered(ContextType ctx, const U &collection, size_t argc, const ValueType arguments[]) {
    auto query_string = Value::validated_to_string(ctx, arguments[0], "predicate");
    auto query = collection.get_query();
    auto const &realm = collection.get_realm();
    auto const &object_schema = collection.get_object_schema();

    std::vector<ValueType> args(&arguments[1], &arguments[argc]);

    parser::Predicate predicate = parser::parse(query_string);
    query_builder::ArgumentConverter<ValueType, ContextType> converter(ctx, realm, args);
    query_builder::apply_predicate(query, predicate, converter, realm->schema(), object_schema.name);

    return create_instance(ctx, realm::Results(realm, std::move(query)));
}

template<typename T>
template<typename U>
typename T::Object ResultsClass<T>::create_sorted(ContextType ctx, const U &collection, size_t argc, const ValueType arguments[]) {
    auto const &realm = collection.get_realm();
    auto const &object_schema = collection.get_object_schema();
    auto const &table = *ObjectStore::table_for_object_type(realm->read_group(), object_schema.name);
    std::vector<std::vector<size_t>> columns;
    std::vector<bool> ascending;

    auto get_column = [&](std::string prop_name) {
        const Property *prop = object_schema.property_for_name(prop_name);
        if (!prop) {
            throw std::runtime_error(util::format("Property '%1' does not exist on object type '%2'", prop_name, object_schema.name));
        }
        return prop->table_column;
    };

    if (Value::is_array(ctx, arguments[0])) {
        validate_argument_count(argc, 1, "Second argument is not allowed if passed an array of sort descriptors");

        ObjectType js_prop_names = Value::validated_to_object(ctx, arguments[0]);
        size_t prop_count = Object::validated_get_length(ctx, js_prop_names);
        if (!prop_count) {
            throw std::invalid_argument("Sort descriptor array must not be empty");
        }

        columns.resize(prop_count);
        ascending.resize(prop_count);

        for (unsigned int i = 0; i < prop_count; i++) {
            ValueType value = Object::validated_get_property(ctx, js_prop_names, i);

            if (Value::is_array(ctx, value)) {
                ObjectType array = Value::to_array(ctx, value);
                columns[i] = {get_column(Object::validated_get_string(ctx, array, 0))};
                ascending[i] = !Object::validated_get_boolean(ctx, array, 1);
            }
            else {
                columns[i] = {get_column(Value::validated_to_string(ctx, value))};
                ascending[i] = true;
            }
        }
    }
    else {
        validate_argument_count(argc, 1, 2);

        columns.push_back({get_column(Value::validated_to_string(ctx, arguments[0]))});
        ascending.push_back(argc == 1 || !Value::to_boolean(ctx, arguments[1]));
    }

    auto results = new Collection(realm, collection.get_query(),
                                  SortDescriptor{table, std::move(columns), std::move(ascending)});
    return create_object<T, ResultsClass<T>>(ctx, results);
}

template<typename T>
void ResultsClass<T>::get_length(ContextType ctx, ObjectType object, ReturnValue &return_value) {
    auto results = get_internal<T, ResultsClass<T>>(object);
    return_value.set((uint32_t)results->size());
}

template<typename T>
void ResultsClass<T>::get_index(ContextType ctx, ObjectType object, uint32_t index, ReturnValue &return_value) {
    auto results = get_internal<T, ResultsClass<T>>(object);
    auto row = results->get(index);

    // Return null for deleted objects in a snapshot.
    if (!row.is_attached()) {
        return_value.set_null();
        return;
    }

    auto realm_object = realm::Object(results->get_realm(), results->get_object_schema(), results->get(index));
    return_value.set(RealmObjectClass<T>::create_instance(ctx, std::move(realm_object)));
}

template<typename T>
void ResultsClass<T>::snapshot(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    validate_argument_count(argc, 0);

    auto results = get_internal<T, ResultsClass<T>>(this_object);
    return_value.set(ResultsClass<T>::create_instance(ctx, results->snapshot()));
}

template<typename T>
void ResultsClass<T>::filtered(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    validate_argument_count_at_least(argc, 1);

    auto results = get_internal<T, ResultsClass<T>>(this_object);
    return_value.set(create_filtered(ctx, *results, argc, arguments));
}

template<typename T>
void ResultsClass<T>::sorted(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    validate_argument_count(argc, 1, 2);

    auto results = get_internal<T, ResultsClass<T>>(this_object);
    return_value.set(create_sorted(ctx, *results, argc, arguments));
}

template<typename T>
void ResultsClass<T>::is_valid(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    return_value.set(get_internal<T, ResultsClass<T>>(this_object)->is_valid());
}

template<typename T>
void ResultsClass<T>::add_listener(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    validate_argument_count(argc, 1);

    auto results = get_internal<T, ResultsClass<T>>(this_object);
    results->add_listener(ctx, this_object, arguments[0]);
}

template<typename T>
void ResultsClass<T>::remove_listener(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    validate_argument_count(argc, 1);

    auto results = get_internal<T, ResultsClass<T>>(this_object);
    results->remove_listener(Protected<ObjectType>(ctx, Value::validated_to_function(ctx, arguments[0])));
}

template<typename T>
void ResultsClass<T>::remove_all_listeners(ContextType ctx, ObjectType this_object, size_t argc, const ValueType arguments[], ReturnValue &return_value) {
    validate_argument_count(argc, 0);
    get_internal<T, ResultsClass<T>>(this_object)->remove_all_listeners();
}

} // js
} // realm
