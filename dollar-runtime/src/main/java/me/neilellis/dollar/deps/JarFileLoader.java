/*
 * Copyright (c) 2014 Neil Ellis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package me.neilellis.dollar.deps;

import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;

/**
 * @author <a href="http://uk.linkedin.com/in/neilellis">Neil Ellis</a>
 */

public class JarFileLoader extends URLClassLoader {
    public JarFileLoader(URL[] urls) {
        super(urls);
    }

    public static void main(String args[]) {
        try {
            System.out.println("First attempt...");
            Class.forName("org.gjt.mm.mysql.Driver");
        } catch (Exception ex) {
            System.out.println("Failed.");
        }

        try {
            URL urls[] = {};

            JarFileLoader cl = new JarFileLoader(urls);
            cl.addFile("/opt/mysql-connector-java-5.0.4/mysql-connector-java-5.0.4-bin.jar");
            System.out.println("Second attempt...");
            cl.loadClass("org.gjt.mm.mysql.Driver");
            System.out.println("Success!");
        } catch (Exception ex) {
            System.out.println("Failed.");
            ex.printStackTrace();
        }
    }

    public void addFile(String path) throws MalformedURLException {
        String urlPath = "jar:file://" + path + "!/";
        addURL(new URL(urlPath));
    }
}