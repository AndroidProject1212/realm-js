/* Copyright 2015 Realm Inc - All Rights Reserved
 * Proprietary and Confidential
 */

#pragma once

#include "js_util.hpp"
#include <memory>

namespace realm {
    class Realm;
    class Query;
    typedef std::shared_ptr<Realm> SharedRealm;
}

JSClassRef RJSResultsClass();
JSObjectRef RJSResultsCreate(JSContextRef ctx, realm::SharedRealm realm, std::string className);
JSObjectRef RJSResultsCreate(JSContextRef ctx, realm::SharedRealm realm, std::string className, std::string query, std::vector<JSValueRef> args);
JSObjectRef RJSResultsCreate(JSContextRef ctx, realm::SharedRealm realm, const realm::ObjectSchema &objectSchema, realm::Query query, size_t argumentCount, const JSValueRef arguments[]);
JSObjectRef RJSResultsCreate(JSContextRef ctx, realm::SharedRealm realm, const realm::ObjectSchema &objectSchema, realm::Query query, bool live = true);

